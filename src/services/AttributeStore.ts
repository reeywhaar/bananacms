import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import {
  attribute,
  parentAttribute,
  post,
  category,
  page,
  tag,
  localizations,
} from '@cms/lib/db/schema'
import { EntityQuery, type BaseQueryState, type SortOrder } from './queryBuilder/EntityQuery'

export type AttributeData = {
  id: string
  key: string
  translatable: boolean
  text: string
}

export type AttributeOrderField = 'key' | 'id'

type ParentTable = 'post' | 'category' | 'page' | 'block' | 'tag'

type ParentSpec = {
  table: ParentTable
  id?: string
  ids?: string[]
  shortid?: string
  slug?: string
  key?: string
}

type AttributeQueryState = BaseQueryState<AttributeOrderField> & {
  parentSpec?: ParentSpec
  keyFilter?: string
  translatableFilter?: boolean
}

type RawAttributeRow = {
  id: string
  key: string
  translatable: number
  text: string
}

export class AttributeStore {
  constructor(private db: Db) {}

  query(): AttributeQuery {
    return AttributeQuery.for(this.db)
  }

  /** Convenience used by BlockQuery during row hydration. */
  async getByParent(parentTable: string, parentId: string): Promise<AttributeData[]> {
    const rows = await this.db
      .select({
        id: attribute.id,
        key: attribute.key,
        translatable: attribute.translatable,
        text: attribute.text,
      })
      .from(attribute)
      .innerJoin(parentAttribute, eq(parentAttribute.attributeId, attribute.id))
      .where(
        and(eq(parentAttribute.parentTable, parentTable), eq(parentAttribute.parentId, parentId)),
      )
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      translatable: r.translatable === 1,
      text: r.text,
    }))
  }

  /** Batched variant of getByParent: one query covering many parents. */
  async getByParents(
    parentTable: string,
    parentIds: string[],
  ): Promise<Record<string, AttributeData[]>> {
    if (parentIds.length === 0) return {}
    const rows = await this.db
      .select({
        id: attribute.id,
        key: attribute.key,
        translatable: attribute.translatable,
        text: attribute.text,
        parentId: parentAttribute.parentId,
      })
      .from(attribute)
      .innerJoin(parentAttribute, eq(parentAttribute.attributeId, attribute.id))
      .where(
        and(
          eq(parentAttribute.parentTable, parentTable),
          inArray(parentAttribute.parentId, parentIds),
        ),
      )
    const result: Record<string, AttributeData[]> = {}
    for (const r of rows) {
      ;(result[r.parentId] ??= []).push({
        id: r.id,
        key: r.key,
        translatable: r.translatable === 1,
        text: r.text,
      })
    }
    return result
  }

  async saveByParent(parentTable: string, parentId: string, attrs: AttributeData[]): Promise<void> {
    validateAttributes(attrs)
    const orphans = (
      await this.db
        .select({ id: parentAttribute.attributeId })
        .from(parentAttribute)
        .where(
          and(eq(parentAttribute.parentTable, parentTable), eq(parentAttribute.parentId, parentId)),
        )
    ).map((r) => r.id)
    if (orphans.length > 0) {
      await this.db.delete(attribute).where(inArray(attribute.id, orphans))
    }
    for (const attr of attrs) {
      await this.db.insert(attribute).values({
        id: attr.id,
        key: attr.key,
        translatable: attr.translatable ? 1 : 0,
        text: attr.text,
      })
      await this.db.insert(parentAttribute).values({ attributeId: attr.id, parentId, parentTable })
    }
  }
}

const validateAttributes = (attrs: AttributeData[]): void => {
  const seen = new Set<string>()
  for (const attr of attrs) {
    if (!attr.key) throw new Error('Attribute key is required')
    if (seen.has(attr.key)) throw new Error('Duplicate attribute key: ' + attr.key)
    seen.add(attr.key)
  }
}

export class AttributeQuery extends EntityQuery<
  AttributeData,
  AttributeOrderField,
  AttributeQueryState
> {
  static for(db: Db): AttributeQuery {
    return new AttributeQuery(db, { predicates: [] })
  }

  protected clone(patch: Partial<AttributeQueryState>): this {
    return new AttributeQuery(this.db, { ...this.state, ...patch }) as this
  }

  byKey(k: string): this {
    return this.clone({ keyFilter: k })
  }

  byId(id: string): this {
    return this.addPredicate(eq(attribute.id, id))
  }

  translatableOnly(): this {
    return this.clone({ translatableFilter: true })
  }

  nonTranslatableOnly(): this {
    return this.clone({ translatableFilter: false })
  }

  parentedBy(spec: ParentSpec): this {
    return this.clone({ parentSpec: spec })
  }

  async all(): Promise<AttributeData[]> {
    const { state } = this
    const { locale, parentSpec, order, limit, offset } = state
    if (!parentSpec) throw new Error('AttributeQuery requires parentedBy(...) before terminal')

    const textExpr = locale
      ? sql<string>`CASE WHEN ${attribute.translatable} = 1 THEN COALESCE(${localizations.text}, ${attribute.text}) ELSE ${attribute.text} END`.as(
          'text',
        )
      : attribute.text

    let q = this.db
      .select({
        id: attribute.id,
        key: attribute.key,
        translatable: attribute.translatable,
        text: textExpr,
      })
      .from(attribute)
      .innerJoin(parentAttribute, eq(parentAttribute.attributeId, attribute.id))
      .$dynamic()

    const wherePreds = this.applyParentJoinsAndBuildWhere<typeof q>((tbl, on) => {
      q = q.innerJoin(tbl as never, on)
    })

    if (locale) {
      q = q.leftJoin(
        localizations,
        and(
          sql`${localizations.key} = 'attribute:' || ${attribute.id} || ':text'`,
          eq(localizations.locale, locale),
        ),
      )
    }

    q = q.where(and(...wherePreds)).orderBy(...resolveAttributeOrderBy(order))
    if (limit !== undefined) {
      q = q.limit(limit)
      if (offset !== undefined) q = q.offset(offset)
    }

    const rows = (await q) as RawAttributeRow[]
    return rows.map(toAttributeData)
  }

  async count(): Promise<number> {
    const { parentSpec } = this.state
    if (!parentSpec) throw new Error('AttributeQuery requires parentedBy(...) before terminal')

    let q = this.db
      .select({ c: sql<number>`COUNT(*)` })
      .from(attribute)
      .innerJoin(parentAttribute, eq(parentAttribute.attributeId, attribute.id))
      .$dynamic()

    const wherePreds = this.applyParentJoinsAndBuildWhere<typeof q>((tbl, on) => {
      q = q.innerJoin(tbl as never, on)
    })

    q = q.where(and(...wherePreds))
    const rows = (await q) as { c: number }[]
    const row = rows[0]
    if (!row) throw new Error('count: COUNT(*) returned no rows')
    return row.c
  }

  async indexOf(fn: (q: this) => this): Promise<number> {
    const { state } = this
    if (!state.parentSpec)
      throw new Error('AttributeQuery requires parentedBy(...) before terminal')

    const anchorState = fn(AttributeQuery.for(this.db) as this).state
    if (!anchorState.predicates.length) return -1

    const [anchor] = (await this.db
      .select({ id: attribute.id, key: attribute.key })
      .from(attribute)
      .where(and(...anchorState.predicates))
      .limit(1)) as { id: string; key: string }[]

    if (!anchor) return -1

    const order = state.order
    const dir = order?.direction === 'desc'

    const primaryCol = order?.field === 'id' ? attribute.id : attribute.key
    const primaryVal = order?.field === 'id' ? anchor.id : anchor.key

    const before = dir
      ? sql`(${primaryCol} > ${primaryVal} OR (${primaryCol} = ${primaryVal} AND ${attribute.id} > ${anchor.id}))`
      : (sql`(${primaryCol} < ${primaryVal} OR (${primaryCol} = ${primaryVal} AND ${attribute.id} < ${anchor.id}))` as SQL)

    let q = this.db
      .select({ c: sql<number>`COUNT(*)` })
      .from(attribute)
      .innerJoin(parentAttribute, eq(parentAttribute.attributeId, attribute.id))
      .$dynamic()

    const wherePreds = this.applyParentJoinsAndBuildWhere<typeof q>((tbl, on) => {
      q = q.innerJoin(tbl as never, on)
    })
    wherePreds.push(before)

    q = q.where(and(...wherePreds))
    const rows = (await q) as { c: number }[]
    const row = rows[0]
    if (!row) throw new Error('indexOf: COUNT(*) returned no rows')
    return row.c
  }

  private applyParentJoinsAndBuildWhere<_Q>(addJoin: (tbl: unknown, on: SQL) => void): SQL[] {
    const { parentSpec, keyFilter, translatableFilter, predicates } = this.state
    if (!parentSpec) return []

    const wherePreds: SQL[] = [...predicates, eq(parentAttribute.parentTable, parentSpec.table)]

    if (parentSpec.id !== undefined) {
      wherePreds.push(eq(parentAttribute.parentId, parentSpec.id))
    } else if (parentSpec.ids !== undefined) {
      if (parentSpec.ids.length === 0) {
        wherePreds.push(sql`0`)
      } else {
        wherePreds.push(inArray(parentAttribute.parentId, parentSpec.ids))
      }
    } else {
      const parentTbl = parentTableRef(parentSpec.table)
      if (!parentTbl) {
        throw new Error(`Parent lookup not supported for table=${parentSpec.table}`)
      }
      addJoin(parentTbl, eq(parentTbl.id, parentAttribute.parentId))
      if (parentSpec.shortid !== undefined && 'shortid' in parentTbl) {
        wherePreds.push(eq(parentTbl.shortid as never, parentSpec.shortid))
      } else if (parentSpec.slug !== undefined && 'slug' in parentTbl) {
        wherePreds.push(eq(parentTbl.slug as never, parentSpec.slug))
      } else if (parentSpec.key !== undefined && parentSpec.table === 'page') {
        wherePreds.push(eq(page.key, parentSpec.key))
      } else {
        throw new Error('parentedBy spec requires id|ids|shortid|slug|key matching the table')
      }
    }

    if (keyFilter !== undefined) wherePreds.push(eq(attribute.key, keyFilter))
    if (translatableFilter !== undefined) {
      wherePreds.push(eq(attribute.translatable, translatableFilter ? 1 : 0))
    }

    return wherePreds
  }
}

function parentTableRef(t: ParentTable) {
  if (t === 'post') return post
  if (t === 'category') return category
  if (t === 'page') return page
  if (t === 'tag') return tag
  return null
}

function resolveAttributeOrderBy(
  order: { field: AttributeOrderField; direction: SortOrder } | undefined,
): SQL[] {
  if (!order) return [asc(attribute.id)]
  const dir = order.direction === 'desc' ? desc : asc
  if (order.field === 'key') return [dir(attribute.key), asc(attribute.id)]
  return [dir(attribute.id)]
}

function toAttributeData(row: RawAttributeRow): AttributeData {
  return {
    id: row.id,
    key: row.key,
    translatable: row.translatable === 1,
    text: row.text,
  }
}
