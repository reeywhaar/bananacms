import { and, asc, desc, eq, like, sql, type SQL } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import { category, parentPost, localizations } from '@cms/lib/db/schema'
import {
  EntityQuery,
  type BaseQueryState,
  type SortOrder,
} from './queryBuilder/EntityQuery'

export type CategoryData = {
  id: string
  shortid: string
  name: string
  slug: string
  postCount: number
}

export type CategoryOrderField = 'name' | 'slug' | 'id'

type CategoryQueryState = BaseQueryState<CategoryOrderField>

export class CategoryQuery extends EntityQuery<
  CategoryData,
  CategoryOrderField,
  CategoryQueryState
> {
  static for(db: Db): CategoryQuery {
    return new CategoryQuery(db, { predicates: [] })
  }

  protected clone(patch: Partial<CategoryQueryState>): this {
    return new CategoryQuery(this.db, { ...this.state, ...patch }) as this
  }

  byId(id: string): this {
    return this.addPredicate(eq(category.id, id))
  }

  byShortId(s: string): this {
    return this.addPredicate(eq(category.shortid, s))
  }

  bySlug(s: string): this {
    return this.addPredicate(eq(category.slug, s))
  }

  nameMatches(pattern: string): this {
    return this.addPredicate(like(category.name, pattern))
  }

  async all(): Promise<CategoryData[]> {
    return (await this.buildSelect({ countOnly: false })) as CategoryData[]
  }

  async count(): Promise<number> {
    const rows = (await this.buildSelect({ countOnly: true })) as { c: number }[]
    return rows[0]?.c ?? 0
  }

  private async buildSelect(opts: { countOnly: boolean }): Promise<unknown[]> {
    const { state } = this
    const { locale, predicates, limit, offset, order } = state

    if (opts.countOnly) {
      let q = this.db
        .select({ c: sql<number>`COUNT(DISTINCT ${category.id})` })
        .from(category)
        .$dynamic()
      if (predicates.length) q = q.where(and(...predicates))
      return q
    }

    const nameExpr = locale
      ? sql<string>`COALESCE(${localizations.text}, ${category.name})`.as('name')
      : category.name

    let q = this.db
      .select({
        id: category.id,
        shortid: category.shortid,
        slug: category.slug,
        name: nameExpr,
        postCount: sql<number>`COUNT(${parentPost.postId})`.as('postCount'),
      })
      .from(category)
      .leftJoin(
        parentPost,
        and(eq(parentPost.parentTable, 'category'), eq(parentPost.parentId, category.id)),
      )
      .$dynamic()

    if (locale) {
      q = q.leftJoin(
        localizations,
        and(
          sql`${localizations.key} = 'category:' || ${category.id} || ':name'`,
          eq(localizations.locale, locale),
        ),
      )
    }

    if (predicates.length) q = q.where(and(...predicates))

    q = q.groupBy(category.id).orderBy(...resolveOrderBy(order))

    if (limit !== undefined) {
      q = q.limit(limit)
      if (offset !== undefined) q = q.offset(offset)
    }

    return q
  }
}

function resolveOrderBy(
  order: { field: CategoryOrderField; direction: SortOrder } | undefined,
): SQL[] {
  if (!order) return [asc(category.id)]
  const dir = order.direction === 'desc' ? desc : asc
  const colMap: Record<CategoryOrderField, ReturnType<typeof asc>> = {
    name: dir(category.name),
    slug: dir(category.slug),
    id: dir(category.id),
  }
  return [colMap[order.field], asc(category.id)]
}
