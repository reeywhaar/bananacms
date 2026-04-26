import { Database } from 'sqlite'
import { valita } from '@cms/utils/valita'
import {
  GetByParentOptionsBase,
  buildGetByParentQuery,
  parentQueryVariantSchema,
  parseIdentifier,
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

const attributeQuerySchema = valita.union(
  parentQueryVariantSchema(
    valita.literal('post'),
    valita.union(valita.literal('id'), valita.literal('shortid'), valita.literal('slug')),
  ),
  parentQueryVariantSchema(
    valita.literal('category'),
    valita.union(valita.literal('id'), valita.literal('shortid'), valita.literal('slug')),
  ),
  parentQueryVariantSchema(
    valita.literal('page'),
    valita.union(valita.literal('id'), valita.literal('key')),
  ),
  parentQueryVariantSchema(valita.literal('block'), valita.literal('id')),
)
const attributeOrderFieldSchema = valita.union(valita.literal('id'), valita.literal('key'))

export type AttributeQuery = valita.Infer<typeof attributeQuerySchema>
export type AttributeOrderField = valita.Infer<typeof attributeOrderFieldSchema>
export type AttributeGetOptions = GetByParentOptionsBase<AttributeOrderField>

const ATTR_ORDER_FIELDS: Record<AttributeOrderField, string> = {
  id: 'a.id',
  key: 'a.key',
}

export class AttributeStore {
  constructor(private db: Database) {}

  async get(
    query: AttributeQuery,
    options: AttributeGetOptions = {},
  ): Promise<AttributeData[]> {
    parseIdentifier(attributeQuerySchema, query, 'query')
    if (options.order) parseIdentifier(attributeOrderFieldSchema, options.order.field, 'order.field')
    if (!query.value) return []

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
      parentTable: query.table,
      parentColumn: query.column,
      condition: query.condition ?? 'eq',
      parentId: query.value,
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
