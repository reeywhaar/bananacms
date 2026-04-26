import { Database } from 'sqlite'
import { LocalizationStore, Translations } from './LocalizationStore'
import { getShortId } from '@cms/utils/getshortid'
import { valita } from '@cms/utils/valita'
import {
  GetByParentOptionsBase,
  allQueryVariantSchema,
  buildGetByParentQuery,
  columnQueryVariantSchema,
  parentQueryVariantSchema,
  parseIdentifier,
  sqlOrder,
} from './getByParentQuery'

const tagChildColumnSchema = valita.union(
  valita.literal('id'),
  valita.literal('shortid'),
  valita.literal('slug'),
)
const tagQuerySchema = valita.union(
  allQueryVariantSchema(),
  columnQueryVariantSchema(tagChildColumnSchema),
  parentQueryVariantSchema(
    valita.literal('post'),
    valita.union(valita.literal('id'), valita.literal('shortid'), valita.literal('slug')),
  ),
)
const tagOrderFieldSchema = valita.union(valita.literal('name'), valita.literal('id'))

export type TagQuery = valita.Infer<typeof tagQuerySchema>
export type TagOrderField = valita.Infer<typeof tagOrderFieldSchema>
export type TagGetOptions = GetByParentOptionsBase<TagOrderField>

const TAG_CHILD_COLUMNS: Record<valita.Infer<typeof tagChildColumnSchema>, string> = {
  id: 't.id',
  shortid: 't.shortid',
  slug: 't.slug',
}
const TAG_ORDER_FIELDS: Record<TagOrderField, string> = {
  name: 't.name',
  id: 't.id',
}

const conditionToSql = (c: 'eq' | 'neq' | 'like'): string =>
  c === 'eq' ? '=' : c === 'neq' ? '!=' : 'LIKE'

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
}

export class TagStore {
  constructor(private db: Database) {}

  async get(query: TagQuery, options: TagGetOptions = {}): Promise<TagData[]> {
    parseIdentifier(tagQuerySchema, query, 'query')
    if (options.order) parseIdentifier(tagOrderFieldSchema, options.order.field, 'order.field')
    if (query.type !== 'all' && !query.value) return []

    // For `all`, expose postCount via aggregation. For other variants we don't
    // need the count and want plain row-per-tag results, so the SELECT differs.
    const isAll = query.type === 'all'
    const selectColumns = isAll
      ? options.locale
        ? `t.id, t.shortid, t.slug, COALESCE(l.text, t.name) AS name,
           COUNT(pt.tagId) AS postCount`
        : `t.id, t.shortid, t.slug, t.name, COUNT(pt.tagId) AS postCount`
      : options.locale
        ? `t.id, t.shortid, t.slug, COALESCE(l.text, t.name) AS name`
        : `t.id, t.shortid, t.slug, t.name`

    const orderBy = options.order
      ? `${TAG_ORDER_FIELDS[options.order.field]} ${sqlOrder(options.order.order)}`
      : `t.name ASC`

    const localeJoins = options.locale
      ? {
          sql: `  LEFT JOIN localizations l ON l.key = 'tag:' || t.id || ':name' AND l.locale = ?`,
          params: [options.locale] as unknown[],
        }
      : undefined

    if (query.type === 'parent') {
      const { sql, params } = buildGetByParentQuery({
        child: {
          childTable: 'tag',
          childAlias: 't',
          joinTable: 'parent_tag',
          joinAlias: 'pt',
          joinChildKey: 'tagId',
        },
        selectColumns,
        parentTable: query.table,
        parentColumn: query.column,
        condition: query.condition ?? 'eq',
        parentId: query.value,
        orderBy,
        limit: options.limit,
        offset: options.offset,
        localeJoins,
      })
      return this.db.all<TagData[]>(sql, ...params)
    }

    const params: unknown[] = []
    const lines: string[] = [`SELECT ${selectColumns}`, `  FROM tag t`]
    if (isAll) {
      lines.push(`  LEFT JOIN parent_tag pt ON pt.tagId = t.id AND pt.parentTable = 'post'`)
    }
    if (localeJoins) {
      lines.push(localeJoins.sql)
      params.push(...localeJoins.params)
    }
    if (query.type === 'column') {
      lines.push(
        ` WHERE ${TAG_CHILD_COLUMNS[query.column]} ${conditionToSql(query.condition ?? 'eq')} ?`,
      )
      params.push(query.value)
    }
    if (isAll) lines.push(' GROUP BY t.id')
    lines.push(` ORDER BY ${orderBy}`)
    if (options.limit !== undefined) {
      lines.push(' LIMIT ?')
      params.push(options.limit)
      if (options.offset !== undefined) {
        lines.push(' OFFSET ?')
        params.push(options.offset)
      }
    }
    return this.db.all<TagData[]>(lines.join('\n'), ...params)
  }

  async setParent(parentTable: string, parentId: string, tagIds: string[]): Promise<void> {
    await this.db.run(
      'DELETE FROM parent_tag WHERE parentTable = ? AND parentId = ?',
      parentTable,
      parentId,
    )
    for (const tagId of tagIds) {
      await this.db.run(
        'INSERT INTO parent_tag (tagId, parentId, parentTable) VALUES (?, ?, ?)',
        tagId,
        parentId,
        parentTable,
      )
    }
  }

  async add(id: string, payload: TagPayload): Promise<void> {
    validateTagPayload(payload)
    await this.db.run(
      'INSERT INTO tag (id, shortid, name, slug) VALUES (?, ?, ?, ?)',
      id,
      getShortId(id),
      payload.name,
      payload.slug,
    )
    await new LocalizationStore(this.db).save('tag:' + id + ':', payload.translations)
  }

  async update(id: string, payload: TagPayload): Promise<void> {
    validateTagPayload(payload)
    await this.db.run(
      "UPDATE tag SET name = ?, slug = ?, updatedAt = datetime('now') WHERE id = ?",
      payload.name,
      payload.slug,
      id,
    )
    await new LocalizationStore(this.db).save('tag:' + id + ':', payload.translations)
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM tag WHERE id = ?', id)
  }
}

const validateTagPayload = (payload: TagPayload) => {
  if (!payload.name) throw new Error('Name is required')
  if (!payload.slug) throw new Error('Slug is required')
}
