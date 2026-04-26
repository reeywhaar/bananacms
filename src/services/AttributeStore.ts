import { Database } from 'sqlite'
import {
  GetByParentOptionsBase,
  ParentDescriptor,
  assertOneOf,
  buildGetByParentQuery,
  sqlOrder,
} from './getByParentQuery'

export type AttributeData = {
  id: string
  key: string
  translatable: boolean
  text: string
}

type RawAttributeRow = {
  id: string
  key: string
  translatable: number
  text: string
  parentId?: string
}

export type AttributeParentTable = 'post' | 'category' | 'page' | 'block'
export type AttributeParentColumn<P extends AttributeParentTable> = P extends 'page'
  ? 'id' | 'key'
  : P extends 'block'
    ? 'id'
    : 'id' | 'shortid'
export type AttributeParent<P extends AttributeParentTable = AttributeParentTable> = {
  [K in P]: ParentDescriptor<K, AttributeParentColumn<K>>
}[P]
export type AttributeOrderField = 'id' | 'key'
export type AttributeGetByParentOptions = GetByParentOptionsBase<AttributeOrderField>

const ATTR_PARENT_TABLES: ReadonlySet<string> = new Set<AttributeParentTable>([
  'post',
  'category',
  'page',
  'block',
])
const ATTR_PARENT_COLUMNS: Record<AttributeParentTable, ReadonlySet<string>> = {
  post: new Set(['id', 'shortid']),
  category: new Set(['id', 'shortid']),
  page: new Set(['id', 'key']),
  block: new Set(['id']),
}
const ATTR_ORDER_FIELDS: Record<AttributeOrderField, string> = {
  id: 'a.id',
  key: 'a.key',
}

export class AttributeStore {
  constructor(private db: Database) {}

  async getByParent(
    parent: AttributeParent,
    options: AttributeGetByParentOptions = {},
  ): Promise<AttributeData[]> {
    assertOneOf(parent.table, ATTR_PARENT_TABLES, 'parent.table')
    assertOneOf(
      parent.column,
      ATTR_PARENT_COLUMNS[parent.table],
      `parent.column for '${parent.table}'`,
    )
    if (options.order)
      assertOneOf(options.order.field, new Set(Object.keys(ATTR_ORDER_FIELDS)), 'order.field')
    if (!parent.value) return []

    const selectColumns = options.locale
      ? `a.id, a.key, a.translatable,
         CASE WHEN a.translatable = 1 THEN COALESCE(l.text, a.text) ELSE a.text END AS text`
      : `a.id, a.key, a.translatable, a.text`

    const orderBy = options.order
      ? `${ATTR_ORDER_FIELDS[options.order.field]} ${sqlOrder(options.order.order)}`
      : `a.id ASC`

    const { sql, params } = buildGetByParentQuery({
      child: {
        childTable: 'attribute',
        childAlias: 'a',
        joinTable: 'parent_attribute',
        joinAlias: 'pa',
        joinChildKey: 'attributeId',
      },
      selectColumns,
      parentTable: parent.table,
      parentColumn: parent.column,
      condition: parent.condition ?? 'eq',
      parentId: parent.value,
      orderBy,
      limit: options.limit,
      offset: options.offset,
      localeJoins: options.locale
        ? {
            sql: `  LEFT JOIN localizations l ON l.key = 'attribute:' || a.id || ':text' AND l.locale = ?`,
            params: [options.locale],
          }
        : undefined,
    })
    const rows = await this.db.all<RawAttributeRow[]>(sql, ...params)
    return rows.map(toAttributeData)
  }

  async getByParentIds(
    parentTable: string,
    parentIds: string[],
  ): Promise<Record<string, AttributeData[]>> {
    if (parentIds.length === 0) return {}
    const placeholders = parentIds.map(() => '?').join(', ')
    const rows = await this.db.all<RawAttributeRow[]>(
      `SELECT a.id, a.key, a.translatable, a.text, pa.parentId AS parentId
         FROM attribute a
         JOIN parent_attribute pa ON pa.attributeId = a.id
        WHERE pa.parentTable = ? AND pa.parentId IN (${placeholders})
        ORDER BY a.id ASC`,
      parentTable,
      ...parentIds,
    )
    const result: Record<string, AttributeData[]> = {}
    for (const row of rows) {
      const parentId = row.parentId!
      if (!result[parentId]) result[parentId] = []
      result[parentId].push(toAttributeData(row))
    }
    return result
  }

  async saveByParent(
    parentTable: string,
    parentId: string,
    attrs: AttributeData[],
  ): Promise<void> {
    validateAttributes(attrs)
    await this.db.run(
      `DELETE FROM attribute WHERE id IN (
         SELECT attributeId FROM parent_attribute
          WHERE parentTable = ? AND parentId = ?
       )`,
      parentTable,
      parentId,
    )
    for (const attr of attrs) {
      await this.db.run(
        'INSERT INTO attribute (id, key, translatable, text) VALUES (?, ?, ?, ?)',
        attr.id,
        attr.key,
        attr.translatable ? 1 : 0,
        attr.text,
      )
      await this.db.run(
        'INSERT INTO parent_attribute (attributeId, parentId, parentTable) VALUES (?, ?, ?)',
        attr.id,
        parentId,
        parentTable,
      )
    }
  }
}

const toAttributeData = (row: RawAttributeRow): AttributeData => ({
  id: row.id,
  key: row.key,
  translatable: row.translatable === 1,
  text: row.text,
})

const validateAttributes = (attrs: AttributeData[]): void => {
  const seen = new Set<string>()
  for (const attr of attrs) {
    if (!attr.key) throw new Error('Attribute key is required')
    if (seen.has(attr.key)) throw new Error('Duplicate attribute key: ' + attr.key)
    seen.add(attr.key)
  }
}
