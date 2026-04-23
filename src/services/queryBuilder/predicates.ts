import { sql, type SQL } from 'drizzle-orm'
import { type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

export type AttributeSpec = {
  key: string
  /** Exact-match against the raw `attribute.text` (source, untranslated). */
  value?: string
  /** SQL LIKE pattern against `attribute.text`. */
  valueLike?: string
}

export type AttributeHostTable = 'post' | 'category' | 'page' | 'block' | 'tag'

/**
 * Builds an `EXISTS`/`NOT EXISTS` subquery against `parent_attribute JOIN attribute`,
 * scoped to a given host table and host-id column. Used by every entity that
 * can own attributes (post, category, page, block).
 *
 * Modes:
 *   - presence='with',    mode='any'  → EXISTS with OR over specs
 *   - presence='with',    mode='all'  → AND of EXISTS, one per spec
 *   - presence='without', mode='any'  → NOT EXISTS with OR over specs
 */
export function attributeExistsClause(
  hostTable: AttributeHostTable,
  hostIdCol: AnySQLiteColumn,
  specs: AttributeSpec[],
  presence: 'with' | 'without',
  mode: 'any' | 'all' = 'any',
): SQL {
  if (specs.length === 0) {
    return presence === 'with' ? sql`0` : sql`1`
  }

  if (presence === 'with' && mode === 'all') {
    return specs
      .map((s) => singleExists(hostTable, hostIdCol, s, 'with'))
      .reduce<SQL>((acc, c, i) => (i === 0 ? c : sql`${acc} AND ${c}`), sql`1`)
  }

  return groupExists(hostTable, hostIdCol, specs, presence)
}

function singleExists(
  hostTable: AttributeHostTable,
  hostIdCol: AnySQLiteColumn,
  spec: AttributeSpec,
  presence: 'with' | 'without',
): SQL {
  const op = presence === 'with' ? sql.raw('EXISTS') : sql.raw('NOT EXISTS')
  return sql`${op} (
    SELECT 1 FROM parent_attribute pa
      JOIN attribute a ON a.id = pa.attributeId
     WHERE pa.parentTable = ${hostTable}
       AND pa.parentId = ${hostIdCol}
       AND ${matchSpec(spec)}
  )`
}

function groupExists(
  hostTable: AttributeHostTable,
  hostIdCol: AnySQLiteColumn,
  specs: AttributeSpec[],
  presence: 'with' | 'without',
): SQL {
  const op = presence === 'with' ? sql.raw('EXISTS') : sql.raw('NOT EXISTS')
  const orred = specs
    .map(matchSpec)
    .reduce<SQL>((acc, c, i) => (i === 0 ? c : sql`${acc} OR ${c}`), sql`0`)
  return sql`${op} (
    SELECT 1 FROM parent_attribute pa
      JOIN attribute a ON a.id = pa.attributeId
     WHERE pa.parentTable = ${hostTable}
       AND pa.parentId = ${hostIdCol}
       AND (${orred})
  )`
}

function matchSpec(spec: AttributeSpec): SQL {
  const parts: SQL[] = [sql`a.key = ${spec.key}`]
  if (spec.value !== undefined) parts.push(sql`a.text = ${spec.value}`)
  if (spec.valueLike !== undefined) parts.push(sql`a.text LIKE ${spec.valueLike}`)
  return parts.reduce<SQL>((acc, c, i) => (i === 0 ? c : sql`${acc} AND ${c}`), sql`1`)
}

// ---------------------------------------------------------------------------
// post / block / asset existence clauses — same pattern as attributes:
// EXISTS (or NOT EXISTS) subquery against the relevant `parent_*` table,
// scoped to a host entity's id, with optional inner join to the child table
// for slug/shortid/type lookups.
// ---------------------------------------------------------------------------

export type PostSpec = { id?: string; slug?: string; shortid?: string }

export type PostHostTable = 'category'

export function postExistsClause(
  hostTable: PostHostTable,
  hostIdCol: AnySQLiteColumn,
  specs: PostSpec[],
  presence: 'with' | 'without',
  mode: 'any' | 'all' = 'any',
): SQL {
  if (specs.length === 0) return presence === 'with' ? sql`0` : sql`1`
  if (presence === 'with' && mode === 'all') {
    return specs
      .map((s) => singlePostExists(hostTable, hostIdCol, s, 'with'))
      .reduce<SQL>((acc, c, i) => (i === 0 ? c : sql`${acc} AND ${c}`), sql`1`)
  }
  return groupPostExists(hostTable, hostIdCol, specs, presence)
}

function singlePostExists(
  hostTable: PostHostTable,
  hostIdCol: AnySQLiteColumn,
  spec: PostSpec,
  presence: 'with' | 'without',
): SQL {
  const op = presence === 'with' ? sql.raw('EXISTS') : sql.raw('NOT EXISTS')
  const join = postSpecNeedsChildJoin(spec)
    ? sql.raw('JOIN post cp ON cp.id = pp.postId')
    : sql.raw('')
  return sql`${op} (
    SELECT 1 FROM parent_post pp
    ${join}
    WHERE pp.parentTable = ${hostTable}
      AND pp.parentId = ${hostIdCol}
      AND ${matchPostSpec(spec)}
  )`
}

function groupPostExists(
  hostTable: PostHostTable,
  hostIdCol: AnySQLiteColumn,
  specs: PostSpec[],
  presence: 'with' | 'without',
): SQL {
  const op = presence === 'with' ? sql.raw('EXISTS') : sql.raw('NOT EXISTS')
  const needsJoin = specs.some(postSpecNeedsChildJoin)
  const join = needsJoin ? sql.raw('JOIN post cp ON cp.id = pp.postId') : sql.raw('')
  const orred = specs
    .map(matchPostSpec)
    .reduce<SQL>((acc, c, i) => (i === 0 ? c : sql`${acc} OR ${c}`), sql`0`)
  return sql`${op} (
    SELECT 1 FROM parent_post pp
    ${join}
    WHERE pp.parentTable = ${hostTable}
      AND pp.parentId = ${hostIdCol}
      AND (${orred})
  )`
}

function postSpecNeedsChildJoin(spec: PostSpec): boolean {
  return spec.slug !== undefined || spec.shortid !== undefined
}

function matchPostSpec(spec: PostSpec): SQL {
  const parts: SQL[] = []
  if (spec.id !== undefined) parts.push(sql`pp.postId = ${spec.id}`)
  if (spec.slug !== undefined) parts.push(sql`cp.slug = ${spec.slug}`)
  if (spec.shortid !== undefined) parts.push(sql`cp.shortid = ${spec.shortid}`)
  if (parts.length === 0) {
    throw new Error('PostSpec requires at least one of: id, slug, shortid')
  }
  return parts.reduce<SQL>((acc, c, i) => (i === 0 ? c : sql`${acc} AND ${c}`), sql`1`)
}

export type BlockSpec = { id?: string; type?: string }

export type BlockHostTable = 'post' | 'category' | 'page' | 'tag'

export function blockExistsClause(
  hostTable: BlockHostTable,
  hostIdCol: AnySQLiteColumn,
  specs: BlockSpec[],
  presence: 'with' | 'without',
  mode: 'any' | 'all' = 'any',
): SQL {
  if (specs.length === 0) return presence === 'with' ? sql`0` : sql`1`
  if (presence === 'with' && mode === 'all') {
    return specs
      .map((s) => singleBlockExists(hostTable, hostIdCol, s, 'with'))
      .reduce<SQL>((acc, c, i) => (i === 0 ? c : sql`${acc} AND ${c}`), sql`1`)
  }
  return groupBlockExists(hostTable, hostIdCol, specs, presence)
}

function singleBlockExists(
  hostTable: BlockHostTable,
  hostIdCol: AnySQLiteColumn,
  spec: BlockSpec,
  presence: 'with' | 'without',
): SQL {
  const op = presence === 'with' ? sql.raw('EXISTS') : sql.raw('NOT EXISTS')
  const join = blockSpecNeedsChildJoin(spec)
    ? sql.raw('JOIN block cb ON cb.id = pb.blockId')
    : sql.raw('')
  return sql`${op} (
    SELECT 1 FROM parent_block pb
    ${join}
    WHERE pb.parentTable = ${hostTable}
      AND pb.parentId = ${hostIdCol}
      AND ${matchBlockSpec(spec)}
  )`
}

function groupBlockExists(
  hostTable: BlockHostTable,
  hostIdCol: AnySQLiteColumn,
  specs: BlockSpec[],
  presence: 'with' | 'without',
): SQL {
  const op = presence === 'with' ? sql.raw('EXISTS') : sql.raw('NOT EXISTS')
  const needsJoin = specs.some(blockSpecNeedsChildJoin)
  const join = needsJoin ? sql.raw('JOIN block cb ON cb.id = pb.blockId') : sql.raw('')
  const orred = specs
    .map(matchBlockSpec)
    .reduce<SQL>((acc, c, i) => (i === 0 ? c : sql`${acc} OR ${c}`), sql`0`)
  return sql`${op} (
    SELECT 1 FROM parent_block pb
    ${join}
    WHERE pb.parentTable = ${hostTable}
      AND pb.parentId = ${hostIdCol}
      AND (${orred})
  )`
}

function blockSpecNeedsChildJoin(spec: BlockSpec): boolean {
  return spec.type !== undefined
}

function matchBlockSpec(spec: BlockSpec): SQL {
  const parts: SQL[] = []
  if (spec.id !== undefined) parts.push(sql`pb.blockId = ${spec.id}`)
  if (spec.type !== undefined) parts.push(sql`json_extract(cb.content, '$.type') = ${spec.type}`)
  if (parts.length === 0) {
    throw new Error('BlockSpec requires at least one of: id, type')
  }
  return parts.reduce<SQL>((acc, c, i) => (i === 0 ? c : sql`${acc} AND ${c}`), sql`1`)
}

export type AssetSpec = { id?: string }

export type AssetHostTable = 'block'

export function assetExistsClause(
  hostTable: AssetHostTable,
  hostIdCol: AnySQLiteColumn,
  specs: AssetSpec[],
  presence: 'with' | 'without',
  mode: 'any' | 'all' = 'any',
): SQL {
  if (specs.length === 0) return presence === 'with' ? sql`0` : sql`1`
  if (presence === 'with' && mode === 'all') {
    return specs
      .map((s) => singleAssetExists(hostTable, hostIdCol, s, 'with'))
      .reduce<SQL>((acc, c, i) => (i === 0 ? c : sql`${acc} AND ${c}`), sql`1`)
  }
  return groupAssetExists(hostTable, hostIdCol, specs, presence)
}

function singleAssetExists(
  hostTable: AssetHostTable,
  hostIdCol: AnySQLiteColumn,
  spec: AssetSpec,
  presence: 'with' | 'without',
): SQL {
  const op = presence === 'with' ? sql.raw('EXISTS') : sql.raw('NOT EXISTS')
  return sql`${op} (
    SELECT 1 FROM parent_asset pa
    WHERE pa.parentTable = ${hostTable}
      AND pa.parentId = ${hostIdCol}
      AND ${matchAssetSpec(spec)}
  )`
}

function groupAssetExists(
  hostTable: AssetHostTable,
  hostIdCol: AnySQLiteColumn,
  specs: AssetSpec[],
  presence: 'with' | 'without',
): SQL {
  const op = presence === 'with' ? sql.raw('EXISTS') : sql.raw('NOT EXISTS')
  const orred = specs
    .map(matchAssetSpec)
    .reduce<SQL>((acc, c, i) => (i === 0 ? c : sql`${acc} OR ${c}`), sql`0`)
  return sql`${op} (
    SELECT 1 FROM parent_asset pa
    WHERE pa.parentTable = ${hostTable}
      AND pa.parentId = ${hostIdCol}
      AND (${orred})
  )`
}

function matchAssetSpec(spec: AssetSpec): SQL {
  if (spec.id !== undefined) return sql`pa.assetId = ${spec.id}`
  // No-spec match: any asset row at all (presence-only filter).
  return sql`1`
}
