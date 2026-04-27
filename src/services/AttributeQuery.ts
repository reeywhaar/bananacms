import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import {
  attribute,
  parentAttribute,
  post,
  category,
  page,
  localizations,
} from '@cms/lib/db/schema'
import {
  EntityQuery,
  type BaseQueryState,
  type SortOrder,
} from './queryBuilder/EntityQuery'

export type AttributeData = {
  id: string
  key: string
  translatable: boolean
  text: string
}

export type AttributeOrderField = 'key' | 'id'

type ParentTable = 'post' | 'category' | 'page' | 'block'

type ParentSpec = {
  table: ParentTable
  id?: string
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

    q = q.where(and(...wherePreds)).orderBy(...resolveOrderBy(order))
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
    return rows[0]?.c ?? 0
  }

  private applyParentJoinsAndBuildWhere<_Q>(
    addJoin: (tbl: unknown, on: SQL) => void,
  ): SQL[] {
    const { parentSpec, keyFilter, translatableFilter, predicates } = this.state
    if (!parentSpec) return []

    const wherePreds: SQL[] = [...predicates, eq(parentAttribute.parentTable, parentSpec.table)]

    if (parentSpec.id !== undefined) {
      wherePreds.push(eq(parentAttribute.parentId, parentSpec.id))
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
        throw new Error('parentedBy spec requires id|shortid|slug|key matching the table')
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
  return null
}

function resolveOrderBy(
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
