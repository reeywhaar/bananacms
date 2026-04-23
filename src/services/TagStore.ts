import { and, asc, desc, eq, like, sql, type SQL } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import { tag, parentTag, post, localizations } from '@cms/lib/db/schema'
import { getShortId } from '@cms/utils/getshortid'
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

export type TagData = {
  id: string
  shortid: string
  name: string
  slug: string
  postCount?: number
}

export type TagPayload = {
  name: string
  slug: string
  translations: Translations
  attributes: AttributeData[]
  blocks: BlockData[]
}

export type TagOrderField = 'name' | 'createdAt' | 'updatedAt' | 'id'

type TagParentSpec = {
  table: 'post'
  id?: string
  ids?: string[]
  shortid?: string
  slug?: string
}

type TagQueryState = BaseQueryState<TagOrderField> & {
  taggedTo?: TagParentSpec
  postCount: boolean
}

export class TagStore {
  constructor(private db: Db) {}

  query(): TagQuery {
    return TagQuery.for(this.db)
  }

  async setParent(parentTable: string, parentId: string, tagIds: string[]): Promise<void> {
    await this.db
      .delete(parentTag)
      .where(and(eq(parentTag.parentTable, parentTable), eq(parentTag.parentId, parentId)))
    for (const tagId of tagIds) {
      await this.db.insert(parentTag).values({ tagId, parentId, parentTable })
    }
  }

  async add(id: string, payload: TagPayload): Promise<void> {
    validateTagPayload(payload)
    await this.db.transaction(async (tx) => {
      await tx.insert(tag).values({
        id,
        shortid: getShortId(id),
        name: payload.name,
        slug: payload.slug,
      })
      await new AttributeStore(tx).saveByParent('tag', id, payload.attributes)
      await new BlockStore(tx).saveByParent('tag', id, payload.blocks)
      await new LocalizationStore(tx).save('tag:' + id + ':', payload.translations)
    })
  }

  async update(id: string, payload: TagPayload): Promise<void> {
    validateTagPayload(payload)
    await this.db.transaction(async (tx) => {
      await tx
        .update(tag)
        .set({
          name: payload.name,
          slug: payload.slug,
          updatedAt: sql`(datetime('now'))`,
        })
        .where(eq(tag.id, id))
      await new LocalizationStore(tx).deleteBlockTranslationsByParentId('tag', id)
      await new AttributeStore(tx).saveByParent('tag', id, payload.attributes)
      await new BlockStore(tx).saveByParent('tag', id, payload.blocks)
      await new LocalizationStore(tx).save('tag:' + id + ':', payload.translations)
    })
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(tag).where(eq(tag.id, id))
  }
}

const validateTagPayload = (payload: TagPayload) => {
  if (!payload.name) throw new Error('Name is required')
  if (!payload.slug) throw new Error('Slug is required')
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

  taggedTo(spec: TagParentSpec): this {
    return this.clone({ taggedTo: spec })
  }

  withPostCount(): this {
    return this.clone({ postCount: true })
  }

  withAttribute(spec: AttributeSpec): this {
    return this.addPredicate(attributeExistsClause('tag', tag.id, [spec], 'with'))
  }

  withoutAttribute(spec: AttributeSpec): this {
    return this.addPredicate(attributeExistsClause('tag', tag.id, [spec], 'without'))
  }

  withAnyAttribute(specs: AttributeSpec[]): this {
    return this.addPredicate(attributeExistsClause('tag', tag.id, specs, 'with', 'any'))
  }

  withAllAttributes(specs: AttributeSpec[]): this {
    return this.addPredicate(attributeExistsClause('tag', tag.id, specs, 'with', 'all'))
  }

  withBlock(spec: BlockSpec): this {
    return this.addPredicate(blockExistsClause('tag', tag.id, [spec], 'with'))
  }

  withoutBlock(spec: BlockSpec): this {
    return this.addPredicate(blockExistsClause('tag', tag.id, [spec], 'without'))
  }

  withAnyBlock(specs: BlockSpec[]): this {
    return this.addPredicate(blockExistsClause('tag', tag.id, specs, 'with', 'any'))
  }

  withAllBlocks(specs: BlockSpec[]): this {
    return this.addPredicate(blockExistsClause('tag', tag.id, specs, 'with', 'all'))
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
      q = q.groupBy(tag.id).orderBy(...resolveTagOrderBy(order))
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
    q = q.orderBy(...resolveTagOrderBy(order))
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
    const row = rows[0]
    if (!row) throw new Error('count: COUNT(*) returned no rows')
    return row.c
  }

  async indexOf(fn: (q: this) => this): Promise<number> {
    const { state } = this
    const anchorState = fn(TagQuery.for(this.db) as this).state
    if (!anchorState.predicates.length) return -1

    const [anchor] = (await this.db
      .select({
        id: tag.id,
        name: tag.name,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
      })
      .from(tag)
      .where(and(...anchorState.predicates))
      .limit(1)) as { id: string; name: string; createdAt: string; updatedAt: string }[]

    if (!anchor) return -1

    const order = state.order
    const dir = order?.direction === 'desc'

    const cols = { name: tag.name, createdAt: tag.createdAt, updatedAt: tag.updatedAt, id: tag.id }
    const vals = {
      name: anchor.name,
      createdAt: anchor.createdAt,
      updatedAt: anchor.updatedAt,
      id: anchor.id,
    }
    const primaryCol = cols[order?.field ?? 'name']
    const primaryVal = vals[order?.field ?? 'name']

    const before = dir
      ? sql`(${primaryCol} > ${primaryVal} OR (${primaryCol} = ${primaryVal} AND ${tag.id} > ${anchor.id}))`
      : (sql`(${primaryCol} < ${primaryVal} OR (${primaryCol} = ${primaryVal} AND ${tag.id} < ${anchor.id}))` as SQL)

    let q = this.db
      .select({ c: sql<number>`COUNT(DISTINCT ${tag.id})` })
      .from(tag)
      .$dynamic()

    const wherePreds = this.buildWhere()
    wherePreds.push(before)
    if (wherePreds.length) q = q.where(and(...wherePreds))

    const rows = (await q) as { c: number }[]
    const row = rows[0]
    if (!row) throw new Error('indexOf: COUNT(*) returned no rows')
    return row.c
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

function resolveTagOrderBy(
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
