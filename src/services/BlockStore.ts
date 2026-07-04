import { and, asc, desc, eq, gt, inArray, lt, notInArray, or, sql, type SQL } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import {
  attribute,
  block,
  parentAttribute,
  parentBlock,
  post,
  page,
  category,
  tag,
  asset,
  parentAsset,
} from '@cms/lib/db/schema'
import { type BlockData, type BlockType, blockParentSchema } from '@cms/lib/blocks/declarations'
import { intoResult } from '@cms/utils/result'
import { LocalizationStore, type Translations } from './LocalizationStore'
import { AttributeStore } from './AttributeStore'
import { EntityQuery, type BaseQueryState, type SortOrder } from './queryBuilder/EntityQuery'
import {
  assetExistsClause,
  attributeExistsClause,
  type AssetSpec,
  type AttributeSpec,
} from './queryBuilder/predicates'

export class PostNotFoundError extends Error {}
export class InvalidBlockContentError extends Error {}

export type BlockOrderField = 'position' | 'id'

export type BlockParentTable = 'post' | 'page' | 'category' | 'block' | 'tag'

type ParentSpec = {
  table: BlockParentTable
  id?: string
  ids?: string[]
  slug?: string
  shortid?: string
  key?: string
}

type BlockQueryState = BaseQueryState<BlockOrderField> & {
  hydrate: boolean
  parentSpec?: ParentSpec
}

type RawBlockRow = {
  id: string
  parentId: string | null
  parentTable: string | null
  content: string
}

export class BlockStore {
  constructor(private db: Db) {}

  query(): BlockQuery {
    return BlockQuery.for(this.db)
  }

  async getPublicByParentIds(
    locale: string,
    parentTable: BlockParentTable,
    ids: string[],
  ): Promise<Record<string, BlockData[]>> {
    if (ids.length === 0) return {}

    // One batched query for top-level blocks across all parents; BlockQuery
    // handles group hydration and translations internally (the latter via a
    // single recursive-CTE call covering every parent id at once).
    const blocks = await BlockQuery.for(this.db)
      .locale(locale)
      .parentedBy({ table: parentTable, ids })
      .all()

    const result: Record<string, BlockData[]> = {}
    for (const id of ids) result[id] = []
    for (const b of blocks) {
      if (b.parent.type !== parentTable) continue
      const bucket = result[b.parent.id]
      if (bucket) bucket.push(b)
    }
    return result
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(block).where(eq(block.id, id))
    return (result.rowsAffected ?? 0) > 0
  }

  async deleteByParent(parentTable: string, parentId: string): Promise<void> {
    const orphanIds = (
      await this.db.all<{ blockId: string }>(sql`
        WITH RECURSIVE block_tree(blockId) AS (
          SELECT blockId FROM parent_block
           WHERE parentTable = ${parentTable} AND parentId = ${parentId}
          UNION ALL
          SELECT pb.blockId FROM parent_block pb
            INNER JOIN block_tree bt ON pb.parentTable = 'block' AND pb.parentId = bt.blockId
        )
        SELECT blockId FROM block_tree
      `)
    ).map((r) => r.blockId)
    if (orphanIds.length === 0) return
    // parent_attribute has no FK on parentId, so block attributes must be
    // swept explicitly or they survive as orphans (deleting the attribute
    // cascades its parent_attribute row).
    const attributeIds = (
      await this.db
        .select({ id: parentAttribute.attributeId })
        .from(parentAttribute)
        .where(
          and(
            eq(parentAttribute.parentTable, 'block'),
            inArray(parentAttribute.parentId, orphanIds),
          ),
        )
    ).map((r) => r.id)
    if (attributeIds.length > 0) {
      await this.db.delete(attribute).where(inArray(attribute.id, attributeIds))
    }
    await this.db.delete(block).where(inArray(block.id, orphanIds))
  }

  async saveByParent(parentTable: string, parentId: string, blocks: BlockData[]): Promise<void> {
    await this.deleteByParent(parentTable, parentId)
    await this.insertBlocks(blocks, { parentTable, parentId })
    const referenced = (await this.db.select({ id: parentAsset.assetId }).from(parentAsset)).map(
      (r) => r.id,
    )
    if (referenced.length === 0) {
      await this.db.delete(asset)
    } else {
      await this.db.delete(asset).where(notInArray(asset.id, referenced))
    }
  }

  private async insertBlocks(
    blocks: BlockData[],
    parent: { parentTable: string; parentId: string },
  ): Promise<void> {
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]
      const isGroup = b.content.type === 'group'
      const content = isGroup
        ? JSON.stringify({ type: b.content.type, key: b.content.key })
        : JSON.stringify(b.content)
      await this.db.insert(block).values({ id: b.id, content })
      await this.db.insert(parentBlock).values({
        blockId: b.id,
        parentId: parent.parentId,
        parentTable: parent.parentTable,
        position: i,
      })
      await new AttributeStore(this.db).saveByParent('block', b.id, b.attributes)
      if ((b.content.type === 'image' || b.content.type === 'asset') && b.content.assetId) {
        await this.db
          .insert(parentAsset)
          .values({ assetId: b.content.assetId, parentId: b.id, parentTable: 'block' })
          .onConflictDoNothing()
      }
      if (b.content.type === 'group') {
        await this.insertBlocks(b.content.blocks, { parentTable: 'block', parentId: b.id })
      }
    }
  }
}

export class BlockQuery extends EntityQuery<BlockData, BlockOrderField, BlockQueryState> {
  static for(db: Db): BlockQuery {
    return new BlockQuery(db, { predicates: [], hydrate: true })
  }

  protected clone(patch: Partial<BlockQueryState>): this {
    return new BlockQuery(this.db, { ...this.state, ...patch }) as this
  }

  byId(id: string): this {
    return this.addPredicate(eq(block.id, id))
  }

  ofType(t: string): this {
    return this.addPredicate(sql`json_extract(${block.content}, '$.type') = ${t}`)
  }

  notOfType(t: string): this {
    return this.addPredicate(sql`json_extract(${block.content}, '$.type') != ${t}`)
  }

  parentedBy(spec: ParentSpec): this {
    return this.clone({ parentSpec: spec })
  }

  flat(): this {
    return this.clone({ hydrate: false })
  }

  withAttribute(spec: AttributeSpec): this {
    return this.addPredicate(attributeExistsClause('block', block.id, [spec], 'with'))
  }

  withoutAttribute(spec: AttributeSpec): this {
    return this.addPredicate(attributeExistsClause('block', block.id, [spec], 'without'))
  }

  withAnyAttribute(specs: AttributeSpec[]): this {
    return this.addPredicate(attributeExistsClause('block', block.id, specs, 'with', 'any'))
  }

  withAllAttributes(specs: AttributeSpec[]): this {
    return this.addPredicate(attributeExistsClause('block', block.id, specs, 'with', 'all'))
  }

  withAsset(spec: AssetSpec = {}): this {
    return this.addPredicate(assetExistsClause('block', block.id, [spec], 'with'))
  }

  withoutAsset(spec: AssetSpec = {}): this {
    return this.addPredicate(assetExistsClause('block', block.id, [spec], 'without'))
  }

  withAnyAsset(specs: AssetSpec[]): this {
    return this.addPredicate(assetExistsClause('block', block.id, specs, 'with', 'any'))
  }

  withAllAssets(specs: AssetSpec[]): this {
    return this.addPredicate(assetExistsClause('block', block.id, specs, 'with', 'all'))
  }

  async all(): Promise<BlockData[]> {
    const rows = await this.fetchRows()
    const blocks = await this.hydrateRows(rows)
    if (!this.state.locale) return blocks

    const byTable = new Map<string, Set<string>>()
    for (const r of rows) {
      if (!r.parentTable || !r.parentId) continue
      let bucket = byTable.get(r.parentTable)
      if (!bucket) {
        bucket = new Set()
        byTable.set(r.parentTable, bucket)
      }
      bucket.add(r.parentId)
    }
    const allTranslations: Translations = {}
    const localizationStore = new LocalizationStore(this.db)
    for (const [table, ids] of byTable) {
      const t = await localizationStore.getByBlockParentIds(table, [...ids])
      for (const [locale, entries] of Object.entries(t)) {
        if (!allTranslations[locale]) allTranslations[locale] = {}
        Object.assign(allTranslations[locale], entries)
      }
    }
    const locale = this.state.locale
    return blocks.map((b) => applyTranslations(b, allTranslations, locale))
  }

  async count(): Promise<number> {
    let q = this.db
      .select({ c: sql<number>`COUNT(*)` })
      .from(block)
      .leftJoin(parentBlock, eq(parentBlock.blockId, block.id))
      .$dynamic()

    const wherePreds = this.applyParentSpecJoinsAndWhere(q, false)
    q = wherePreds.q
    if (wherePreds.where.length) q = q.where(and(...wherePreds.where))

    const rows = (await q) as { c: number }[]
    const row = rows[0]
    if (!row) throw new Error('count: COUNT(*) returned no rows')
    return row.c
  }

  async indexOf(fn: (q: this) => this): Promise<number> {
    const { state } = this
    const anchorState = fn(BlockQuery.for(this.db) as this).state
    if (!anchorState.predicates.length) return -1

    const [anchor] = (await this.db
      .select({ id: block.id, position: parentBlock.position })
      .from(block)
      .leftJoin(parentBlock, eq(parentBlock.blockId, block.id))
      .where(and(...anchorState.predicates))
      .limit(1)) as { id: string; position: number | null }[]

    if (!anchor) return -1

    const order = state.order
    const dir = order?.direction === 'desc'
    const cmp = dir ? gt : lt

    let before: SQL
    if (!order || order.field === 'position') {
      if (anchor.position === null) return -1
      before = or(
        cmp(parentBlock.position, anchor.position),
        and(eq(parentBlock.position, anchor.position), cmp(block.id, anchor.id))!,
      )!
    } else {
      before = cmp(block.id, anchor.id)
    }

    let q = this.db
      .select({ c: sql<number>`COUNT(*)` })
      .from(block)
      .leftJoin(parentBlock, eq(parentBlock.blockId, block.id))
      .$dynamic()

    const wherePreds = this.applyParentSpecJoinsAndWhere(q, false)
    q = wherePreds.q
    const allPreds = [...wherePreds.where, before]
    q = q.where(and(...allPreds))

    const rows = (await q) as { c: number }[]
    const row = rows[0]
    if (!row) throw new Error('indexOf: COUNT(*) returned no rows')
    return row.c
  }

  private async fetchRows(): Promise<RawBlockRow[]> {
    const { order, limit, offset } = this.state
    let q = this.db
      .select({
        id: block.id,
        parentId: parentBlock.parentId,
        parentTable: parentBlock.parentTable,
        content: block.content,
      })
      .from(block)
      .leftJoin(parentBlock, eq(parentBlock.blockId, block.id))
      .$dynamic()

    const wherePreds = this.applyParentSpecJoinsAndWhere(q, true)
    q = wherePreds.q
    if (wherePreds.where.length) q = q.where(and(...wherePreds.where))

    q = q.orderBy(...resolveBlockOrderBy(order))
    if (limit !== undefined) {
      q = q.limit(limit)
      if (offset !== undefined) q = q.offset(offset)
    }
    return (await q) as RawBlockRow[]
  }

  private applyParentSpecJoinsAndWhere<T extends { innerJoin: (...args: never[]) => T }>(
    q: T,
    _forSelect: boolean,
  ): { q: T; where: SQL[] } {
    const { parentSpec, predicates } = this.state
    const where: SQL[] = [...predicates]
    if (!parentSpec) return { q, where }

    where.push(eq(parentBlock.parentTable, parentSpec.table))
    if (parentSpec.id !== undefined) {
      where.push(eq(parentBlock.parentId, parentSpec.id))
    } else if (parentSpec.ids !== undefined) {
      if (parentSpec.ids.length === 0) {
        where.push(sql`0`)
      } else {
        where.push(inArray(parentBlock.parentId, parentSpec.ids))
      }
    }

    if (
      parentSpec.shortid !== undefined &&
      parentSpec.table !== 'block' &&
      parentSpec.table !== 'page'
    ) {
      // post / category / tag all have shortid columns

      const parentTable = parentTableRef(parentSpec.table)
      if (parentTable) {
        q = (q as unknown as { innerJoin: (t: typeof parentTable, on: SQL) => T }).innerJoin(
          parentTable,
          eq(parentTable.id, parentBlock.parentId),
        )
        where.push(eq(parentTable.shortid, parentSpec.shortid))
      }
    } else if (
      parentSpec.slug !== undefined &&
      (parentSpec.table === 'post' || parentSpec.table === 'category' || parentSpec.table === 'tag')
    ) {
      const parentTable = parentTableRef(parentSpec.table)
      if (parentTable) {
        q = (q as unknown as { innerJoin: (t: typeof parentTable, on: SQL) => T }).innerJoin(
          parentTable,
          eq(parentTable.id, parentBlock.parentId),
        )
        where.push(eq(parentTable.slug, parentSpec.slug))
      }
    } else if (parentSpec.key !== undefined && parentSpec.table === 'page') {
      q = (q as unknown as { innerJoin: (t: typeof page, on: SQL) => T }).innerJoin(
        page,
        eq(page.id, parentBlock.parentId),
      )
      where.push(eq(page.key, parentSpec.key))
    }

    return { q, where }
  }

  /**
   * Turns raw rows into BlockData without per-row queries: all descendants
   * of group blocks come from one recursive-CTE query and all attributes
   * from one IN query, instead of one query per group and per block.
   */
  private async hydrateRows(rows: RawBlockRow[]): Promise<BlockData[]> {
    if (rows.length === 0) return []

    const childRows = this.state.hydrate
      ? await this.fetchDescendantRows(rows.map((r) => r.id))
      : []
    const childrenByParent = new Map<string, RawBlockRow[]>()
    for (const row of childRows) {
      if (row.parentId == null) continue
      const bucket = childrenByParent.get(row.parentId)
      if (bucket) bucket.push(row)
      else childrenByParent.set(row.parentId, [row])
    }

    const attributesByBlock = await new AttributeStore(this.db).getByParents('block', [
      ...rows.map((r) => r.id),
      ...childRows.map((r) => r.id),
    ])

    const build = (raw: RawBlockRow): BlockData => {
      if (raw.parentId == null || raw.parentTable == null)
        throw new InvalidBlockContentError('Block has no parent')
      const parentResult = intoResult(() =>
        blockParentSchema.parse({ type: raw.parentTable, id: raw.parentId }),
      )
      if (parentResult.error) throw new InvalidBlockContentError('Invalid parent table')
      const parent = parentResult.value

      const parsed = JSON.parse(raw.content) as unknown
      if (parsed == null || typeof parsed !== 'object')
        throw new InvalidBlockContentError('Invalid block content')
      if (!('type' in parsed) || typeof parsed.type !== 'string')
        throw new InvalidBlockContentError('Invalid block content: missing type')
      if (!('key' in parsed) || typeof parsed.key !== 'string')
        throw new InvalidBlockContentError('Invalid block content: missing key')

      const content: BlockType =
        parsed.type === 'group' && this.state.hydrate
          ? {
              type: 'group',
              key: parsed.key,
              blocks: (childrenByParent.get(raw.id) ?? []).map(build),
            }
          : (parsed as BlockType)

      return { id: raw.id, parent, content, attributes: attributesByBlock[raw.id] ?? [] }
    }

    return rows.map(build)
  }

  /**
   * All blocks below the given ones (children of groups, recursively), in
   * per-parent position order. UNION (not UNION ALL) so a block reachable
   * from several seed ids is returned once.
   */
  private async fetchDescendantRows(ids: string[]): Promise<RawBlockRow[]> {
    if (ids.length === 0) return []
    const idList = sql.join(
      ids.map((id) => sql`${id}`),
      sql.raw(', '),
    )
    return await this.db.all<RawBlockRow>(sql`
      WITH RECURSIVE block_tree(blockId) AS (
        SELECT blockId FROM parent_block
         WHERE parentTable = 'block' AND parentId IN (${idList})
        UNION
        SELECT pb.blockId FROM parent_block pb
          INNER JOIN block_tree bt ON pb.parentTable = 'block' AND pb.parentId = bt.blockId
      )
      SELECT b.id, pb.parentId, pb.parentTable, b.content
        FROM block b
        JOIN parent_block pb ON pb.blockId = b.id
       WHERE b.id IN (SELECT blockId FROM block_tree)
       ORDER BY pb.position ASC, b.id ASC
    `)
  }
}

function parentTableRef(t: BlockParentTable) {
  if (t === 'post') return post
  if (t === 'category') return category
  if (t === 'tag') return tag
  return null
}

function resolveBlockOrderBy(
  order: { field: BlockOrderField; direction: SortOrder } | undefined,
): SQL[] {
  if (!order) return [asc(parentBlock.position)]
  const dir = order.direction === 'desc' ? desc : asc
  if (order.field === 'position') return [dir(parentBlock.position)]
  return [dir(block.id)]
}

const applyTranslations = (
  block: BlockData,
  translations: Translations,
  locale: string,
): BlockData => {
  const localeMap = translations[locale]
  if (!localeMap) return block

  if (block.content.type === 'text') {
    const text = localeMap['block:' + block.id + ':text']
    if (!text) return block
    return { ...block, content: { ...block.content, text } }
  }

  if (block.content.type === 'image') {
    const alt = localeMap['block:' + block.id + ':alt']
    if (!alt) return block
    return { ...block, content: { ...block.content, alt } }
  }

  if (block.content.type === 'group') {
    return {
      ...block,
      content: {
        ...block.content,
        blocks: block.content.blocks.map((b) => applyTranslations(b, translations, locale)),
      },
    }
  }

  return block
}
