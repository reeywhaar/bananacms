import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import { page } from '@cms/lib/db/schema'
import { BlockData } from '@cms/lib/blocks/declarations'
import { BlockStore } from './BlockStore'
import { LocalizationStore, Translations } from './LocalizationStore'
import { AttributeStore, AttributeData } from './AttributeStore'
import { EntityQuery, type BaseQueryState, type SortOrder } from './queryBuilder/EntityQuery'
import {
  attributeExistsClause,
  blockExistsClause,
  type AttributeSpec,
  type BlockSpec,
} from './queryBuilder/predicates'

export type PageData = {
  id: string
  key: string
  name: string
}

export type PagePayload = {
  key: string
  blocks: BlockData[]
  translations: Translations
  attributes: AttributeData[]
}

export type PageOrderField = 'key' | 'id'

type PageQueryState = BaseQueryState<PageOrderField>

export class PageStore {
  constructor(private db: Db) {}

  query(): PageQuery {
    return PageQuery.for(this.db)
  }

  async add(id: string, payload: PagePayload): Promise<void> {
    validatePagePayload(payload)
    await this.db.transaction(async (tx) => {
      await tx.insert(page).values({ id, key: payload.key })
      await new AttributeStore(tx).saveByParent('page', id, payload.attributes)
      await new BlockStore(tx).saveByParent('page', id, payload.blocks)
      await new LocalizationStore(tx).save('page:' + id + ':', payload.translations)
    })
  }

  async update(id: string, payload: PagePayload): Promise<void> {
    validatePagePayload(payload)
    await this.db.transaction(async (tx) => {
      await tx.update(page).set({ key: payload.key }).where(eq(page.id, id))
      await new LocalizationStore(tx).deleteBlockTranslationsByParentId('page', id)
      await new AttributeStore(tx).saveByParent('page', id, payload.attributes)
      await new BlockStore(tx).saveByParent('page', id, payload.blocks)
      await new LocalizationStore(tx).save('page:' + id + ':', payload.translations)
    })
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(page).where(eq(page.id, id))
  }
}

const validatePagePayload = (payload: PagePayload) => {
  if (!payload.key) throw new Error('Key is required')
}

export class PageQuery extends EntityQuery<PageData, PageOrderField, PageQueryState> {
  static for(db: Db): PageQuery {
    return new PageQuery(db, { predicates: [] })
  }

  protected clone(patch: Partial<PageQueryState>): this {
    return new PageQuery(this.db, { ...this.state, ...patch }) as this
  }

  byId(id: string): this {
    return this.addPredicate(eq(page.id, id))
  }

  byKey(key: string): this {
    return this.addPredicate(eq(page.key, key))
  }

  withAttribute(spec: AttributeSpec): this {
    return this.addPredicate(attributeExistsClause('page', page.id, [spec], 'with'))
  }

  withoutAttribute(spec: AttributeSpec): this {
    return this.addPredicate(attributeExistsClause('page', page.id, [spec], 'without'))
  }

  withAnyAttribute(specs: AttributeSpec[]): this {
    return this.addPredicate(attributeExistsClause('page', page.id, specs, 'with', 'any'))
  }

  withAllAttributes(specs: AttributeSpec[]): this {
    return this.addPredicate(attributeExistsClause('page', page.id, specs, 'with', 'all'))
  }

  withBlock(spec: BlockSpec): this {
    return this.addPredicate(blockExistsClause('page', page.id, [spec], 'with'))
  }

  withoutBlock(spec: BlockSpec): this {
    return this.addPredicate(blockExistsClause('page', page.id, [spec], 'without'))
  }

  withAnyBlock(specs: BlockSpec[]): this {
    return this.addPredicate(blockExistsClause('page', page.id, specs, 'with', 'any'))
  }

  withAllBlocks(specs: BlockSpec[]): this {
    return this.addPredicate(blockExistsClause('page', page.id, specs, 'with', 'all'))
  }

  async all(): Promise<PageData[]> {
    const { predicates, order, limit, offset } = this.state
    let q = this.db.select({ id: page.id, key: page.key, name: page.key }).from(page).$dynamic()
    if (predicates.length) q = q.where(and(...predicates))
    q = q.orderBy(...resolvePageOrderBy(order))
    if (limit !== undefined) {
      q = q.limit(limit)
      if (offset !== undefined) q = q.offset(offset)
    }
    return (await q) as PageData[]
  }

  async count(): Promise<number> {
    const { predicates } = this.state
    let q = this.db
      .select({ c: sql<number>`COUNT(*)` })
      .from(page)
      .$dynamic()
    if (predicates.length) q = q.where(and(...predicates))
    const rows = (await q) as { c: number }[]
    const row = rows[0]
    if (!row) throw new Error('count: COUNT(*) returned no rows')
    return row.c
  }

  async indexOf(fn: (q: this) => this): Promise<number> {
    const { state } = this
    const anchorState = fn(PageQuery.for(this.db) as this).state
    if (!anchorState.predicates.length) return -1

    const [anchor] = (await this.db
      .select({ id: page.id, key: page.key })
      .from(page)
      .where(and(...anchorState.predicates))
      .limit(1)) as { id: string; key: string }[]

    if (!anchor) return -1

    const order = state.order
    const dir = order?.direction === 'desc'

    const cols = { key: page.key, id: page.id }
    const vals = { key: anchor.key, id: anchor.id }
    const primaryCol = cols[order?.field ?? 'key']
    const primaryVal = vals[order?.field ?? 'key']

    const before = dir
      ? sql`(${primaryCol} > ${primaryVal} OR (${primaryCol} = ${primaryVal} AND ${page.id} > ${anchor.id}))`
      : (sql`(${primaryCol} < ${primaryVal} OR (${primaryCol} = ${primaryVal} AND ${page.id} < ${anchor.id}))` as SQL)

    let q = this.db
      .select({ c: sql<number>`COUNT(*)` })
      .from(page)
      .$dynamic()

    const allPreds = [...state.predicates, before]
    q = q.where(and(...allPreds))

    const rows = (await q) as { c: number }[]
    const row = rows[0]
    if (!row) throw new Error('indexOf: COUNT(*) returned no rows')
    return row.c
  }
}

function resolvePageOrderBy(
  order: { field: PageOrderField; direction: SortOrder } | undefined,
): SQL[] {
  if (!order) return [asc(page.key)]
  const dir = order.direction === 'desc' ? desc : asc
  if (order.field === 'key') return [dir(page.key)]
  return [dir(page.id)]
}
