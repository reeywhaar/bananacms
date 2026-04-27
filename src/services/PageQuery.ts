import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import { page } from '@cms/lib/db/schema'
import {
  EntityQuery,
  type BaseQueryState,
  type SortOrder,
} from './queryBuilder/EntityQuery'

export type PageData = {
  id: string
  key: string
  name: string
}

export type PageOrderField = 'key' | 'id'

type PageQueryState = BaseQueryState<PageOrderField>

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

  async all(): Promise<PageData[]> {
    const { predicates, order, limit, offset } = this.state
    let q = this.db
      .select({ id: page.id, key: page.key, name: page.key })
      .from(page)
      .$dynamic()
    if (predicates.length) q = q.where(and(...predicates))
    q = q.orderBy(...resolveOrderBy(order))
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
    return rows[0]?.c ?? 0
  }
}

function resolveOrderBy(
  order: { field: PageOrderField; direction: SortOrder } | undefined,
): SQL[] {
  if (!order) return [asc(page.key)]
  const dir = order.direction === 'desc' ? desc : asc
  if (order.field === 'key') return [dir(page.key)]
  return [dir(page.id)]
}
