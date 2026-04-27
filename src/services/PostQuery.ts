import { and, asc, desc, eq, gt, gte, like, lt, lte, sql, type SQL } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import { post, parentPost, category, localizations } from '@cms/lib/db/schema'
import {
  EntityQuery,
  type BaseQueryState,
  type SortOrder,
} from './queryBuilder/EntityQuery'
import {
  attributeExistsClause,
  blockExistsClause,
  type AttributeSpec,
  type BlockSpec,
} from './queryBuilder/predicates'

export type PostData = {
  id: string
  shortid: string
  categoryId: string
  name: string
  slug: string
  createdAt: string
  updatedAt: string
  status: 'published' | 'draft'
}

export type PostOrderField = 'position' | 'name' | 'createdAt' | 'updatedAt' | 'id'

type PostQueryState = BaseQueryState<PostOrderField> & {
  categorySlug?: string
}

type TagSpec = { id?: string; shortid?: string; slug?: string }

const tagSpecPredicate = (spec: TagSpec): SQL => {
  if (spec.id) {
    return sql`pt.tagId = ${spec.id}`
  }
  if (spec.shortid) {
    return sql`t.shortid = ${spec.shortid}`
  }
  if (spec.slug) {
    return sql`t.slug = ${spec.slug}`
  }
  throw new Error('tag spec requires one of: id, shortid, slug')
}

const tagExistsClause = (
  spec: TagSpec | TagSpec[],
  presence: 'with' | 'without',
): SQL => {
  const specs = Array.isArray(spec) ? spec : [spec]
  if (specs.length === 0) {
    return presence === 'with' ? sql`0` : sql`1`
  }
  const orPreds = specs.map(tagSpecPredicate)
  const combined = orPreds.reduce<SQL>(
    (acc, p, i) => (i === 0 ? p : sql`${acc} OR ${p}`),
    sql`0`,
  )
  const op = presence === 'with' ? sql.raw('EXISTS') : sql.raw('NOT EXISTS')
  return sql`${op} (
    SELECT 1
      FROM parent_tag pt
      JOIN tag t ON t.id = pt.tagId
     WHERE pt.parentTable = 'post'
       AND pt.parentId = ${post.id}
       AND (${combined})
  )`
}

export class PostQuery extends EntityQuery<PostData, PostOrderField, PostQueryState> {
  static for(db: Db): PostQuery {
    return new PostQuery(db, { predicates: [] })
  }

  protected clone(patch: Partial<PostQueryState>): this {
    return new PostQuery(this.db, { ...this.state, ...patch }) as this
  }

  byId(id: string): this {
    return this.addPredicate(eq(post.id, id))
  }

  byShortId(shortid: string): this {
    return this.addPredicate(eq(post.shortid, shortid))
  }

  bySlug(slug: string): this {
    return this.addPredicate(eq(post.slug, slug))
  }

  status(s: 'published' | 'draft'): this {
    return this.addPredicate(eq(post.status, s))
  }

  published(): this {
    return this.status('published')
  }

  draft(): this {
    return this.status('draft')
  }

  createdAfter(d: string | Date): this {
    return this.addPredicate(gt(post.createdAt, toIso(d)))
  }

  createdBefore(d: string | Date): this {
    return this.addPredicate(lt(post.createdAt, toIso(d)))
  }

  createdBetween(start: string | Date, end: string | Date): this {
    return this.addPredicate(
      and(gte(post.createdAt, toIso(start)), lte(post.createdAt, toIso(end)))!,
    )
  }

  updatedAfter(d: string | Date): this {
    return this.addPredicate(gt(post.updatedAt, toIso(d)))
  }

  updatedBefore(d: string | Date): this {
    return this.addPredicate(lt(post.updatedAt, toIso(d)))
  }

  nameMatches(pattern: string): this {
    return this.addPredicate(like(post.name, pattern))
  }

  inCategory(spec: { id?: string; ids?: string[]; slug?: string }): this {
    if (spec.id !== undefined) {
      return this.addPredicate(eq(parentPost.parentId, spec.id))
    }
    if (spec.ids !== undefined) {
      if (spec.ids.length === 0) return this.addPredicate(sql`0`)
      const idList = sql.join(
        spec.ids.map((v) => sql`${v}`),
        sql.raw(', '),
      )
      return this.addPredicate(sql`${parentPost.parentId} IN (${idList})`)
    }
    if (spec.slug !== undefined) {
      return this.clone({ categorySlug: spec.slug })
    }
    throw new Error('inCategory requires id, ids, or slug')
  }

  withTag(spec: TagSpec): this {
    return this.addPredicate(tagExistsClause(spec, 'with'))
  }

  withoutTag(spec: TagSpec): this {
    return this.addPredicate(tagExistsClause(spec, 'without'))
  }

  withAnyTag(specs: TagSpec[]): this {
    return this.addPredicate(tagExistsClause(specs, 'with'))
  }

  withAllTags(specs: TagSpec[]): this {
    let q = this as PostQuery
    for (const spec of specs) q = q.addPredicate(tagExistsClause(spec, 'with'))
    return q as this
  }

  withAttribute(spec: AttributeSpec): this {
    return this.addPredicate(attributeExistsClause('post', post.id, [spec], 'with'))
  }

  withoutAttribute(spec: AttributeSpec): this {
    return this.addPredicate(attributeExistsClause('post', post.id, [spec], 'without'))
  }

  withAnyAttribute(specs: AttributeSpec[]): this {
    return this.addPredicate(attributeExistsClause('post', post.id, specs, 'with', 'any'))
  }

  withAllAttributes(specs: AttributeSpec[]): this {
    return this.addPredicate(attributeExistsClause('post', post.id, specs, 'with', 'all'))
  }

  withBlock(spec: BlockSpec): this {
    return this.addPredicate(blockExistsClause('post', post.id, [spec], 'with'))
  }

  withoutBlock(spec: BlockSpec): this {
    return this.addPredicate(blockExistsClause('post', post.id, [spec], 'without'))
  }

  withAnyBlock(specs: BlockSpec[]): this {
    return this.addPredicate(blockExistsClause('post', post.id, specs, 'with', 'any'))
  }

  withAllBlocks(specs: BlockSpec[]): this {
    return this.addPredicate(blockExistsClause('post', post.id, specs, 'with', 'all'))
  }

  async all(): Promise<PostData[]> {
    const { state } = this
    const { locale, categorySlug } = state

    const nameExpr = locale
      ? sql<string>`COALESCE(${localizations.text}, ${post.name})`.as('name')
      : post.name

    let q = this.db
      .select({
        id: post.id,
        shortid: post.shortid,
        categoryId: parentPost.parentId,
        slug: post.slug,
        name: nameExpr,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        status: post.status,
      })
      .from(post)
      .leftJoin(
        parentPost,
        and(eq(parentPost.postId, post.id), eq(parentPost.parentTable, 'category')),
      )
      .$dynamic()

    if (categorySlug !== undefined) {
      q = q.innerJoin(category, eq(category.id, parentPost.parentId))
      q = q.where(eq(category.slug, categorySlug))
    }

    if (locale) {
      q = q.leftJoin(
        localizations,
        and(
          sql`${localizations.key} = 'post:' || ${post.id} || ':name'`,
          eq(localizations.locale, locale),
        ),
      )
    }

    if (state.predicates.length) q = q.where(and(...state.predicates))

    q = q.orderBy(...resolveOrderBy(state.order))

    if (state.limit !== undefined) {
      q = q.limit(state.limit)
      if (state.offset !== undefined) q = q.offset(state.offset)
    }

    return (await q) as PostData[]
  }

  async count(): Promise<number> {
    const { state } = this
    const { categorySlug } = state

    let q = this.db
      .select({ c: sql<number>`COUNT(*)` })
      .from(post)
      .leftJoin(
        parentPost,
        and(eq(parentPost.postId, post.id), eq(parentPost.parentTable, 'category')),
      )
      .$dynamic()

    if (categorySlug !== undefined) {
      q = q.innerJoin(category, eq(category.id, parentPost.parentId))
      q = q.where(eq(category.slug, categorySlug))
    }

    if (state.predicates.length) q = q.where(and(...state.predicates))

    const rows = (await q) as { c: number }[]
    return rows[0]?.c ?? 0
  }
}

function resolveOrderBy(
  order: { field: PostOrderField; direction: SortOrder } | undefined,
): SQL[] {
  if (!order) {
    return [asc(parentPost.position), asc(post.id)]
  }
  const colMap: Record<PostOrderField, ReturnType<typeof asc>> = {
    position: order.direction === 'desc' ? desc(parentPost.position) : asc(parentPost.position),
    name: order.direction === 'desc' ? desc(post.name) : asc(post.name),
    createdAt:
      order.direction === 'desc' ? desc(post.createdAt) : asc(post.createdAt),
    updatedAt:
      order.direction === 'desc' ? desc(post.updatedAt) : asc(post.updatedAt),
    id: order.direction === 'desc' ? desc(post.id) : asc(post.id),
  }
  return [colMap[order.field], asc(post.id)]
}

function toIso(d: string | Date): string {
  return d instanceof Date ? d.toISOString() : d
}
