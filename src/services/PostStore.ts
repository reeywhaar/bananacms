import { and, asc, desc, eq, gt, gte, like, lt, lte, sql, type SQL } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import { post, parentPost, category, localizations } from '@cms/lib/db/schema'
import { getShortId } from '@cms/utils/getshortid'
import { BlockData } from '@cms/lib/blocks/declarations'
import { BlockStore } from './BlockStore'
import { LocalizationStore, Translations } from './LocalizationStore'
import { TagStore } from './TagStore'
import { AttributeStore, AttributeData } from './AttributeStore'
import { EntityQuery, type BaseQueryState, type SortOrder } from './queryBuilder/EntityQuery'
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

export type PostPayload = {
  name: string
  slug: string
  categoryId: string
  status: 'published' | 'draft'
  blocks: BlockData[]
  translations: Translations
  tagIds: string[]
  attributes: AttributeData[]
}

export type PostOrderField = 'position' | 'name' | 'createdAt' | 'updatedAt' | 'id'

type PostQueryState = BaseQueryState<PostOrderField> & {
  categorySlug?: string
  textSearchQuery?: string
}

type TagSpec = { id?: string; shortid?: string; slug?: string }

const POSITION_EPSILON = 1e-6

export class PostStore {
  constructor(private db: Db) {}

  query(): PostQuery {
    return PostQuery.for(this.db)
  }

  async add(id: string, payload: PostPayload): Promise<void> {
    validatePostPayload(payload)
    if (!payload.categoryId) throw new Error('Category is required')
    await this.db.transaction(async (tx) => {
      await tx.insert(post).values({
        id,
        shortid: getShortId(id),
        name: payload.name,
        slug: payload.slug,
        status: payload.status,
      })
      const topPosition = await globalTopPosition(tx)
      await tx.insert(parentPost).values({
        postId: id,
        parentId: payload.categoryId,
        parentTable: 'category',
        position: topPosition,
      })
      await new AttributeStore(tx).saveByParent('post', id, payload.attributes)
      await new BlockStore(tx).saveByParent('post', id, payload.blocks)
      await new LocalizationStore(tx).save('post:' + id + ':', payload.translations)
      await new TagStore(tx).setParent('post', id, payload.tagIds)
    })
  }

  async update(id: string, payload: PostPayload): Promise<void> {
    validatePostPayload(payload)
    await this.db.transaction(async (tx) => {
      await tx
        .update(post)
        .set({
          name: payload.name,
          slug: payload.slug,
          status: payload.status,
          updatedAt: sql`(datetime('now'))`,
        })
        .where(eq(post.id, id))
      const existingParent = await tx
        .select({ parentId: parentPost.parentId, parentTable: parentPost.parentTable })
        .from(parentPost)
        .where(eq(parentPost.postId, id))
        .get()
      const categoryChanged =
        !existingParent ||
        existingParent.parentTable !== 'category' ||
        existingParent.parentId !== payload.categoryId
      if (categoryChanged) {
        const topPosition = await topPositionFor(tx, 'category', payload.categoryId)
        await tx
          .update(parentPost)
          .set({
            parentId: payload.categoryId,
            parentTable: 'category',
            position: topPosition,
          })
          .where(eq(parentPost.postId, id))
      }
      await new LocalizationStore(tx).deleteBlockTranslationsByParentId('post', id)
      await new AttributeStore(tx).saveByParent('post', id, payload.attributes)
      await new BlockStore(tx).saveByParent('post', id, payload.blocks)
      await new LocalizationStore(tx).save('post:' + id + ':', payload.translations)
      await new TagStore(tx).setParent('post', id, payload.tagIds)
    })
  }

  async move(
    postId: string,
    anchor: { afterId: string } | { beforeId: string } | null,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const current = await tx
        .select({ parentTable: parentPost.parentTable, parentId: parentPost.parentId })
        .from(parentPost)
        .where(eq(parentPost.postId, postId))
        .get()
      if (!current) throw new Error('Post has no parent')

      const fetchAll = () =>
        tx
          .select({ postId: parentPost.postId, position: parentPost.position })
          .from(parentPost)
          .where(sql`${parentPost.postId} != ${postId}`)
          .orderBy(asc(parentPost.position), asc(parentPost.postId))

      let newPosition: number

      if (anchor === null) {
        // Place first within the post's own category
        const categoryFirst = await tx
          .select({ min: sql<number | null>`MIN(${parentPost.position})` })
          .from(parentPost)
          .where(
            and(
              eq(parentPost.parentTable, current.parentTable),
              eq(parentPost.parentId, current.parentId),
              sql`${parentPost.postId} != ${postId}`,
            ),
          )
          .get()
        const min = categoryFirst?.min
        newPosition = min == null ? 1 : min - 1
      } else if ('afterId' in anchor) {
        const all = await fetchAll()
        const anchorIndex = all.findIndex((s) => s.postId === anchor.afterId)
        if (anchorIndex === -1) throw new Error('afterId not found')
        const a = all[anchorIndex]
        const next = all[anchorIndex + 1]
        if (!next) {
          newPosition = a.position + 1
        } else if (next.position - a.position < POSITION_EPSILON) {
          await rebalanceAll(tx)
          const rebalanced = await fetchAll()
          const idx = rebalanced.findIndex((s) => s.postId === anchor.afterId)
          const ra = rebalanced[idx]
          const rn = rebalanced[idx + 1]
          newPosition = rn ? (ra.position + rn.position) / 2 : ra.position + 1
        } else {
          newPosition = (a.position + next.position) / 2
        }
      } else {
        const all = await fetchAll()
        const anchorIndex = all.findIndex((s) => s.postId === anchor.beforeId)
        if (anchorIndex === -1) throw new Error('beforeId not found')
        const a = all[anchorIndex]
        const prev = all[anchorIndex - 1]
        if (!prev) {
          newPosition = a.position - 1
        } else if (a.position - prev.position < POSITION_EPSILON) {
          await rebalanceAll(tx)
          const rebalanced = await fetchAll()
          const idx = rebalanced.findIndex((s) => s.postId === anchor.beforeId)
          const ra = rebalanced[idx]
          const rp = rebalanced[idx - 1]
          newPosition = rp ? (rp.position + ra.position) / 2 : ra.position - 1
        } else {
          newPosition = (prev.position + a.position) / 2
        }
      }

      await tx
        .update(parentPost)
        .set({ position: newPosition })
        .where(eq(parentPost.postId, postId))
    })
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(post).where(eq(post.id, id))
  }
}

async function topPositionFor(tx: Db, parentTable: string, parentId: string): Promise<number> {
  const row = await tx
    .select({ min: sql<number | null>`MIN(${parentPost.position})` })
    .from(parentPost)
    .where(and(eq(parentPost.parentTable, parentTable), eq(parentPost.parentId, parentId)))
    .get()
  const min = row?.min
  return min == null ? 1 : min - 1
}

async function globalTopPosition(tx: Db): Promise<number> {
  const row = await tx
    .select({ min: sql<number | null>`MIN(${parentPost.position})` })
    .from(parentPost)
    .get()
  const min = row?.min
  return min == null ? 1 : min - 1
}

async function rebalanceAll(tx: Db): Promise<void> {
  const rows = await tx
    .select({ postId: parentPost.postId })
    .from(parentPost)
    .orderBy(asc(parentPost.position), asc(parentPost.postId))
  for (let i = 0; i < rows.length; i++) {
    await tx
      .update(parentPost)
      .set({ position: i + 1 })
      .where(eq(parentPost.postId, rows[i].postId))
  }
}

const validatePostPayload = (payload: PostPayload) => {
  if (!payload.name) throw new Error('Name is required')
  if (!payload.slug) throw new Error('Slug is required')
  if (!payload.categoryId) throw new Error('Category is required')
}

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

const tagExistsClause = (spec: TagSpec | TagSpec[], presence: 'with' | 'without'): SQL => {
  const specs = Array.isArray(spec) ? spec : [spec]
  if (specs.length === 0) {
    return presence === 'with' ? sql`0` : sql`1`
  }
  const orPreds = specs.map(tagSpecPredicate)
  const combined = orPreds.reduce<SQL>((acc, p, i) => (i === 0 ? p : sql`${acc} OR ${p}`), sql`0`)
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

  /**
   * Full-text search across post content (name, blocks, translations, tags,
   * attributes). Accepts a SQLite FTS5 query string. When `.locale()` is also
   * set the search is scoped to that locale (with base-content fallback).
   */
  textSearch(query: string): this {
    return this.clone({ textSearchQuery: query })
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

    if (state.textSearchQuery) {
      const ftsQuery = prepareFtsQuery(state.textSearchQuery)
      const ftsWhere = state.locale
        ? sql`${post.id} IN (SELECT postId FROM post_fts WHERE content MATCH ${ftsQuery} AND (locale = ${state.locale} OR locale = ''))`
        : sql`${post.id} IN (SELECT postId FROM post_fts WHERE content MATCH ${ftsQuery})`
      q = q.where(ftsWhere)
    }

    q = q.orderBy(...resolvePostOrderBy(state.order))

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

    if (state.textSearchQuery) {
      const ftsQuery = prepareFtsQuery(state.textSearchQuery)
      const ftsWhere = state.locale
        ? sql`${post.id} IN (SELECT postId FROM post_fts WHERE content MATCH ${ftsQuery} AND (locale = ${state.locale} OR locale = ''))`
        : sql`${post.id} IN (SELECT postId FROM post_fts WHERE content MATCH ${ftsQuery})`
      q = q.where(ftsWhere)
    }

    const rows = (await q) as { c: number }[]
    const row = rows[0]
    if (!row) throw new Error('count: COUNT(*) returned no rows')
    return row.c
  }

  async indexOf(fn: (q: this) => this): Promise<number> {
    const { state } = this
    const anchorState = fn(PostQuery.for(this.db) as this).state
    if (!anchorState.predicates.length) return -1

    const [anchor] = (await this.db
      .select({
        id: post.id,
        position: parentPost.position,
        name: post.name,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      })
      .from(post)
      .leftJoin(
        parentPost,
        and(eq(parentPost.postId, post.id), eq(parentPost.parentTable, 'category')),
      )
      .where(and(...anchorState.predicates))
      .limit(1)) as {
      id: string
      position: number | null
      name: string
      createdAt: string
      updatedAt: string
    }[]

    if (!anchor) return -1

    const order = state.order
    const dir = order?.direction === 'desc'

    const cols = {
      position: parentPost.position,
      name: post.name,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      id: post.id,
    }
    const vals = {
      position: anchor.position,
      name: anchor.name,
      createdAt: anchor.createdAt,
      updatedAt: anchor.updatedAt,
      id: anchor.id,
    }
    const primaryCol = cols[order?.field ?? 'position']
    const primaryVal = vals[order?.field ?? 'position']

    const before = dir
      ? sql`(${primaryCol} > ${primaryVal} OR (${primaryCol} = ${primaryVal} AND ${post.id} > ${anchor.id}))`
      : (sql`(${primaryCol} < ${primaryVal} OR (${primaryCol} = ${primaryVal} AND ${post.id} < ${anchor.id}))` as SQL)

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

    q = q.where(and(...state.predicates, before))

    const rows = (await q) as { c: number }[]
    const row = rows[0]
    if (!row) throw new Error('indexOf: COUNT(*) returned no rows')
    return row.c
  }
}

function resolvePostOrderBy(
  order: { field: PostOrderField; direction: SortOrder } | undefined,
): SQL[] {
  if (!order) {
    return [asc(parentPost.position), asc(post.id)]
  }
  const colMap: Record<PostOrderField, ReturnType<typeof asc>> = {
    position: order.direction === 'desc' ? desc(parentPost.position) : asc(parentPost.position),
    name: order.direction === 'desc' ? desc(post.name) : asc(post.name),
    createdAt: order.direction === 'desc' ? desc(post.createdAt) : asc(post.createdAt),
    updatedAt: order.direction === 'desc' ? desc(post.updatedAt) : asc(post.updatedAt),
    id: order.direction === 'desc' ? desc(post.id) : asc(post.id),
  }
  return [colMap[order.field], asc(post.id)]
}

function toIso(d: string | Date): string {
  return d instanceof Date ? d.toISOString() : d
}

/**
 * Rewrites a user-supplied search string into an FTS5 prefix query so that
 * partial words match (e.g. "banana" also finds "bananas").
 *
 * Rules:
 * - FTS5 boolean operators (AND, OR, NOT, NEAR) are passed through unchanged.
 * - Quoted phrases ("…") are passed through unchanged.
 * - Tokens already ending with `*` are passed through unchanged.
 * - All other tokens get `*` appended.
 */
function prepareFtsQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .map((token) => {
      if (/^(AND|OR|NOT|NEAR)$/i.test(token)) return token
      if (token.startsWith('"') || token.endsWith('*')) return token
      return token + '*'
    })
    .join(' ')
}
