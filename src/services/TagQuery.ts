import { and, asc, desc, eq, like, sql, type SQL } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import { tag, parentTag, post, localizations } from '@cms/lib/db/schema'
import {
  EntityQuery,
  type BaseQueryState,
  type SortOrder,
} from './queryBuilder/EntityQuery'

export type TagData = {
  id: string
  shortid: string
  name: string
  slug: string
  postCount?: number
}

export type TagOrderField = 'name' | 'createdAt' | 'updatedAt' | 'id'

type ParentSpec = {
  table: 'post'
  id?: string
  ids?: string[]
  shortid?: string
  slug?: string
}

type TagQueryState = BaseQueryState<TagOrderField> & {
  taggedTo?: ParentSpec
  postCount: boolean
}

export class TagQuery extends EntityQuery<TagData, TagOrderField, TagQueryState> {
  static for(db: Db): TagQuery {
    return new TagQuery(db, { predicates: [], postCount: false })
  }

  protected clone(patch: Partial<TagQueryState>): this {
    return new TagQuery(this.db, { ...this.state, ...patch }) as this
  }

  byId(id: string): this {
    return this.addPredicate(eq(tag.id, id))
  }

  byShortId(s: string): this {
    return this.addPredicate(eq(tag.shortid, s))
  }

  bySlug(s: string): this {
    return this.addPredicate(eq(tag.slug, s))
  }

  nameMatches(pattern: string): this {
    return this.addPredicate(like(tag.name, pattern))
  }

  taggedTo(spec: ParentSpec): this {
    return this.clone({ taggedTo: spec })
  }

  withPostCount(): this {
    return this.clone({ postCount: true })
  }

  async all(): Promise<TagData[]> {
    const { state } = this
    const { locale, postCount, limit, offset, order } = state

    const nameExpr = locale
      ? sql<string>`COALESCE(${localizations.text}, ${tag.name})`.as('name')
      : tag.name

    const wherePreds = this.buildWhere()

    if (postCount) {
      let q = this.db
        .select({
          id: tag.id,
          shortid: tag.shortid,
          slug: tag.slug,
          name: nameExpr,
          postCount: sql<number>`COUNT(${parentTag.tagId})`.as('postCount'),
        })
        .from(tag)
        .leftJoin(parentTag, and(eq(parentTag.tagId, tag.id), eq(parentTag.parentTable, 'post')))
        .$dynamic()
      if (locale) {
        q = q.leftJoin(
          localizations,
          and(
            sql`${localizations.key} = 'tag:' || ${tag.id} || ':name'`,
            eq(localizations.locale, locale),
          ),
        )
      }
      if (wherePreds.length) q = q.where(and(...wherePreds))
      q = q.groupBy(tag.id).orderBy(...resolveOrderBy(order))
      if (limit !== undefined) {
        q = q.limit(limit)
        if (offset !== undefined) q = q.offset(offset)
      }
      return (await q) as TagData[]
    }

    let q = this.db
      .select({ id: tag.id, shortid: tag.shortid, slug: tag.slug, name: nameExpr })
      .from(tag)
      .$dynamic()
    if (locale) {
      q = q.leftJoin(
        localizations,
        and(
          sql`${localizations.key} = 'tag:' || ${tag.id} || ':name'`,
          eq(localizations.locale, locale),
        ),
      )
    }
    if (wherePreds.length) q = q.where(and(...wherePreds))
    q = q.orderBy(...resolveOrderBy(order))
    if (limit !== undefined) {
      q = q.limit(limit)
      if (offset !== undefined) q = q.offset(offset)
    }
    return (await q) as TagData[]
  }

  async count(): Promise<number> {
    let q = this.db
      .select({ c: sql<number>`COUNT(DISTINCT ${tag.id})` })
      .from(tag)
      .$dynamic()
    const wherePreds = this.buildWhere()
    if (wherePreds.length) q = q.where(and(...wherePreds))
    const rows = (await q) as { c: number }[]
    return rows[0]?.c ?? 0
  }

  private buildWhere(): SQL[] {
    const { taggedTo, predicates } = this.state
    const wherePreds: SQL[] = [...predicates]

    if (taggedTo) {
      const childParentTag = sql.raw('cpt')
      if (taggedTo.id !== undefined) {
        wherePreds.push(sql`EXISTS (
          SELECT 1 FROM parent_tag ${childParentTag}
           WHERE ${childParentTag}.tagId = ${tag.id}
             AND ${childParentTag}.parentTable = 'post'
             AND ${childParentTag}.parentId = ${taggedTo.id}
        )`)
      } else if (taggedTo.ids !== undefined) {
        if (taggedTo.ids.length === 0) {
          wherePreds.push(sql`0`)
        } else {
          const idList = sql.join(
            taggedTo.ids.map((v) => sql`${v}`),
            sql.raw(', '),
          )
          wherePreds.push(sql`EXISTS (
            SELECT 1 FROM parent_tag ${childParentTag}
             WHERE ${childParentTag}.tagId = ${tag.id}
               AND ${childParentTag}.parentTable = 'post'
               AND ${childParentTag}.parentId IN (${idList})
          )`)
        }
      } else if (taggedTo.shortid !== undefined) {
        wherePreds.push(sql`EXISTS (
          SELECT 1 FROM parent_tag ${childParentTag}
            JOIN ${post} cp ON cp.id = ${childParentTag}.parentId
           WHERE ${childParentTag}.tagId = ${tag.id}
             AND ${childParentTag}.parentTable = 'post'
             AND cp.shortid = ${taggedTo.shortid}
        )`)
      } else if (taggedTo.slug !== undefined) {
        wherePreds.push(sql`EXISTS (
          SELECT 1 FROM parent_tag ${childParentTag}
            JOIN ${post} cp ON cp.id = ${childParentTag}.parentId
           WHERE ${childParentTag}.tagId = ${tag.id}
             AND ${childParentTag}.parentTable = 'post'
             AND cp.slug = ${taggedTo.slug}
        )`)
      }
    }
    return wherePreds
  }
}

function resolveOrderBy(
  order: { field: TagOrderField; direction: SortOrder } | undefined,
): SQL[] {
  if (!order) return [asc(tag.name)]
  const dir = order.direction === 'desc' ? desc : asc
  const colMap: Record<TagOrderField, ReturnType<typeof asc>> = {
    name: dir(tag.name),
    createdAt: dir(tag.createdAt),
    updatedAt: dir(tag.updatedAt),
    id: dir(tag.id),
  }
  return [colMap[order.field], asc(tag.id)]
}
