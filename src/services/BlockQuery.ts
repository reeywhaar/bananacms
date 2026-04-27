import { and, asc, desc, eq, ne, sql, type SQL } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import {
  block,
  parentBlock,
  post,
  page,
  category,
} from '@cms/lib/db/schema'
import {
  type BlockData,
  type BlockType,
  blockParentSchema,
} from '@cms/lib/blocks/declarations'
import { intoResult } from '@cms/utils/result'
import { LocalizationStore, type Translations } from './LocalizationStore'
import { AttributeStore } from './AttributeStore'
import {
  EntityQuery,
  type BaseQueryState,
  type SortOrder,
} from './queryBuilder/EntityQuery'

export type BlockOrderField = 'position' | 'id'

export type BlockParentTable = 'post' | 'page' | 'category' | 'block'
type ParentSpec = { table: BlockParentTable; id?: string; slug?: string; shortid?: string; key?: string }

type BlockQueryState = BaseQueryState<BlockOrderField> & {
  hydrate: boolean
  parentSpec?: ParentSpec
}

type RawBlockRow = {
  id: string
  parentId: string | null
  parentTable: string | null
  type: string
  content: string
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
    return this.addPredicate(eq(block.type, t))
  }

  notOfType(t: string): this {
    return this.addPredicate(ne(block.type, t))
  }

  parentedBy(spec: ParentSpec): this {
    return this.clone({ parentSpec: spec })
  }

  flat(): this {
    return this.clone({ hydrate: false })
  }

  async all(): Promise<BlockData[]> {
    const rows = await this.fetchRows()
    const blocks = await Promise.all(rows.map((r) => this.toBlockData(r)))
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
    return rows[0]?.c ?? 0
  }

  private async fetchRows(): Promise<RawBlockRow[]> {
    const { order, limit, offset } = this.state
    let q = this.db
      .select({
        id: block.id,
        parentId: parentBlock.parentId,
        parentTable: parentBlock.parentTable,
        type: block.type,
        content: block.content,
      })
      .from(block)
      .leftJoin(parentBlock, eq(parentBlock.blockId, block.id))
      .$dynamic()

    const wherePreds = this.applyParentSpecJoinsAndWhere(q, true)
    q = wherePreds.q
    if (wherePreds.where.length) q = q.where(and(...wherePreds.where))

    q = q.orderBy(...resolveOrderBy(order))
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
    }

    if (
      parentSpec.shortid !== undefined &&
      parentSpec.table !== 'block' &&
      parentSpec.table !== 'page'
    ) {
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
      (parentSpec.table === 'post' || parentSpec.table === 'category')
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

  private async toBlockData(raw: RawBlockRow): Promise<BlockData> {
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

    const type = parsed.type
    const key = parsed.key

    const content: BlockType = await (async () => {
      if (type === 'group' && this.state.hydrate) {
        const childRows = (await this.db
          .select({
            id: block.id,
            parentId: parentBlock.parentId,
            parentTable: parentBlock.parentTable,
            type: block.type,
            content: block.content,
          })
          .from(block)
          .leftJoin(parentBlock, eq(parentBlock.blockId, block.id))
          .where(
            and(eq(parentBlock.parentTable, 'block'), eq(parentBlock.parentId, raw.id)),
          )) as RawBlockRow[]
        const blocks = await Promise.all(childRows.map((r) => this.toBlockData(r)))
        return { type: 'group', key, blocks }
      }
      return parsed as BlockType
    })()

    const attributes = await new AttributeStore(this.db).getByParent('block', raw.id)
    return { id: raw.id, parent, type: raw.type, content, attributes }
  }
}

function parentTableRef(t: BlockParentTable) {
  if (t === 'post') return post
  if (t === 'category') return category
  return null
}

function resolveOrderBy(
  order: { field: BlockOrderField; direction: SortOrder } | undefined,
): SQL[] {
  if (!order) return [asc(block.id)]
  const dir = order.direction === 'desc' ? desc : asc
  if (order.field === 'position') return [dir(block.id)]
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

export class InvalidBlockContentError extends Error {}
