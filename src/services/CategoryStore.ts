import { and, asc, desc, eq, like, sql, type SQL } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import { category, parentPost, localizations } from '@cms/lib/db/schema'
import { getShortId } from '@cms/utils/getshortid'
import { BlockData } from '@cms/lib/blocks/declarations'
import { BlockStore } from './BlockStore'
import { LocalizationStore, Translations } from './LocalizationStore'
import { AttributeStore, AttributeData } from './AttributeStore'
import { EntityQuery, type BaseQueryState, type SortOrder } from './queryBuilder/EntityQuery'
import {
  attributeExistsClause,
  blockExistsClause,
  postExistsClause,
  type AttributeSpec,
  type BlockSpec,
  type PostSpec,
} from './queryBuilder/predicates'

export type CategoryData = {
  id: string
  shortid: string
  name: string
  slug: string
  postCount: number
}

export type CategoryPayload = {
  name: string
  slug: string
  blocks: BlockData[]
  translations: Translations
  attributes: AttributeData[]
}

export type CategoryOrderField = 'name' | 'slug' | 'id'

type CategoryQueryState = BaseQueryState<CategoryOrderField>

export class CategoryStore {
  constructor(private db: Db) {}

  query(): CategoryQuery {
    return CategoryQuery.for(this.db)
  }

  async add(id: string, payload: CategoryPayload): Promise<void> {
    validateCategoryPayload(payload)
    await this.db.transaction(async (tx) => {
      await tx
        .insert(category)
        .values({ id, shortid: getShortId(id), name: payload.name, slug: payload.slug })
      await new AttributeStore(tx).saveByParent('category', id, payload.attributes)
      await new BlockStore(tx).saveByParent('category', id, payload.blocks)
      await new LocalizationStore(tx).save('category:' + id + ':', payload.translations)
    })
  }

  async update(id: string, payload: CategoryPayload): Promise<void> {
    validateCategoryPayload(payload)
    await this.db.transaction(async (tx) => {
      await tx
        .update(category)
        .set({ name: payload.name, slug: payload.slug })
        .where(eq(category.id, id))
      await new LocalizationStore(tx).deleteBlockTranslationsByParentId('category', id)
      await new AttributeStore(tx).saveByParent('category', id, payload.attributes)
      await new BlockStore(tx).saveByParent('category', id, payload.blocks)
      await new LocalizationStore(tx).save('category:' + id + ':', payload.translations)
    })
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(category).where(eq(category.id, id))
  }
}

const validateCategoryPayload = (payload: CategoryPayload) => {
  if (!payload.name) throw new Error('Name is required')
  if (!payload.slug) throw new Error('Slug is required')
}

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

  withAttribute(spec: AttributeSpec): this {
    return this.addPredicate(attributeExistsClause('category', category.id, [spec], 'with'))
  }

  withoutAttribute(spec: AttributeSpec): this {
    return this.addPredicate(attributeExistsClause('category', category.id, [spec], 'without'))
  }

  withAnyAttribute(specs: AttributeSpec[]): this {
    return this.addPredicate(attributeExistsClause('category', category.id, specs, 'with', 'any'))
  }

  withAllAttributes(specs: AttributeSpec[]): this {
    return this.addPredicate(attributeExistsClause('category', category.id, specs, 'with', 'all'))
  }

  withPost(spec: PostSpec): this {
    return this.addPredicate(postExistsClause('category', category.id, [spec], 'with'))
  }

  withoutPost(spec: PostSpec): this {
    return this.addPredicate(postExistsClause('category', category.id, [spec], 'without'))
  }

  withAnyPost(specs: PostSpec[]): this {
    return this.addPredicate(postExistsClause('category', category.id, specs, 'with', 'any'))
  }

  withAllPosts(specs: PostSpec[]): this {
    return this.addPredicate(postExistsClause('category', category.id, specs, 'with', 'all'))
  }

  withBlock(spec: BlockSpec): this {
    return this.addPredicate(blockExistsClause('category', category.id, [spec], 'with'))
  }

  withoutBlock(spec: BlockSpec): this {
    return this.addPredicate(blockExistsClause('category', category.id, [spec], 'without'))
  }

  withAnyBlock(specs: BlockSpec[]): this {
    return this.addPredicate(blockExistsClause('category', category.id, specs, 'with', 'any'))
  }

  withAllBlocks(specs: BlockSpec[]): this {
    return this.addPredicate(blockExistsClause('category', category.id, specs, 'with', 'all'))
  }

  async all(): Promise<CategoryData[]> {
    return (await this.buildSelect({ countOnly: false })) as CategoryData[]
  }

  async count(): Promise<number> {
    const rows = (await this.buildSelect({ countOnly: true })) as { c: number }[]
    const row = rows[0]
    if (!row) throw new Error('count: COUNT(*) returned no rows')
    return row.c
  }

  async indexOf(fn: (q: this) => this): Promise<number> {
    const { state } = this
    const anchorState = fn(CategoryQuery.for(this.db) as this).state
    if (!anchorState.predicates.length) return -1

    const [anchor] = (await this.db
      .select({ id: category.id, name: category.name, slug: category.slug })
      .from(category)
      .where(and(...anchorState.predicates))
      .limit(1)) as { id: string; name: string; slug: string }[]

    if (!anchor) return -1

    const order = state.order
    const dir = order?.direction === 'desc'

    const cols = { id: category.id, name: category.name, slug: category.slug }
    const vals = { id: anchor.id, name: anchor.name, slug: anchor.slug }
    const primaryCol = cols[order?.field ?? 'id']
    const primaryVal = vals[order?.field ?? 'id']

    const before = dir
      ? sql`(${primaryCol} > ${primaryVal} OR (${primaryCol} = ${primaryVal} AND ${category.id} > ${anchor.id}))`
      : (sql`(${primaryCol} < ${primaryVal} OR (${primaryCol} = ${primaryVal} AND ${category.id} < ${anchor.id}))` as SQL)

    let q = this.db
      .select({ c: sql<number>`COUNT(DISTINCT ${category.id})` })
      .from(category)
      .$dynamic()

    const allPreds = [...state.predicates, before]
    q = q.where(and(...allPreds))

    const rows = (await q) as { c: number }[]
    const row = rows[0]
    if (!row) throw new Error('indexOf: COUNT(*) returned no rows')
    return row.c
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

    q = q.groupBy(category.id).orderBy(...resolveCategoryOrderBy(order))

    if (limit !== undefined) {
      q = q.limit(limit)
      if (offset !== undefined) q = q.offset(offset)
    }

    return q
  }
}

function resolveCategoryOrderBy(
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
