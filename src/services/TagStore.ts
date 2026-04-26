import { Database } from 'sqlite'
import { LocalizationStore, Translations } from './LocalizationStore'
import { getShortId } from '@cms/utils/getshortid'
import { valita } from '@cms/utils/valita'
import {
  GetByParentOptionsBase,
  buildGetByParentQuery,
  parentDescriptorSchema,
  parseIdentifier,
  sqlOrder,
} from './getByParentQuery'

const tagParentSchema = parentDescriptorSchema(
  valita.literal('post'),
  valita.union(valita.literal('id'), valita.literal('shortid')),
)
const tagOrderFieldSchema = valita.union(valita.literal('name'), valita.literal('id'))

export type TagParent = valita.Infer<typeof tagParentSchema>
export type TagParentTable = TagParent['table']
export type TagParentColumn = TagParent['column']
export type TagOrderField = valita.Infer<typeof tagOrderFieldSchema>
export type TagGetByParentOptions = GetByParentOptionsBase<TagOrderField>

const TAG_ORDER_FIELDS: Record<TagOrderField, string> = {
  name: 't.name',
  id: 't.id',
}

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

  async get(id: string): Promise<TagData | null> {
    const row = await this.db.get<TagData>(
      'SELECT id, shortid, slug, name FROM tag WHERE id = ?',
      id,
    )
    return row || null
  }

  async getAll(): Promise<TagData[]> {
    const rows = await this.db.all<TagData[]>(
      `SELECT t.id, t.shortid, t.slug, t.name,
              COUNT(pt.tagId) AS postCount
         FROM tag t
         LEFT JOIN parent_tag pt
           ON pt.tagId = t.id AND pt.parentTable = 'post'
         GROUP BY t.id
         ORDER BY t.name`,
    )
    return rows
  }

  async getByParent(parent: TagParent, options: TagGetByParentOptions = {}): Promise<TagData[]> {
    parseIdentifier(tagParentSchema, parent, 'parent')
    if (options.order) parseIdentifier(tagOrderFieldSchema, options.order.field, 'order.field')
    if (!parent.value) return []

    const selectColumns = options.locale
      ? `t.id, t.shortid, t.slug, COALESCE(l.text, t.name) AS name`
      : `t.id, t.shortid, t.slug, t.name`

    const orderBy = options.order
      ? `${TAG_ORDER_FIELDS[options.order.field]} ${sqlOrder(options.order.order)}`
      : `t.name ASC`

    const { sql, params } = buildGetByParentQuery({
      child: {
        childTable: 'tag',
        childAlias: 't',
        joinTable: 'parent_tag',
        joinAlias: 'pt',
        joinChildKey: 'tagId',
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
            sql: `  LEFT JOIN localizations l ON l.key = 'tag:' || t.id || ':name' AND l.locale = ?`,
            params: [options.locale],
          }
        : undefined,
    })
    return this.db.all<TagData[]>(sql, ...params)
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

  async getPublicById(locale: string, id: string): Promise<TagData | null> {
    const tag = await this.get(id)
    if (!tag) return null
    const translations = await new LocalizationStore(this.db).getByKeyPrefix('tag:' + id + ':')
    return applyTranslations(tag, translations, locale)
  }

  async getPublicByShortId(locale: string, shortid: string): Promise<TagData | null> {
    const tag = await this.db.get<TagData>(
      'SELECT id, shortid, slug, name FROM tag WHERE shortid = ?',
      shortid,
    )
    if (!tag) return null
    const translations = await new LocalizationStore(this.db).getByKeyPrefix(
      'tag:' + tag.id + ':',
    )
    return applyTranslations(tag, translations, locale)
  }

  async getPublicAll(locale: string): Promise<TagData[]> {
    const tags = await this.getAll()
    const translations = await new LocalizationStore(this.db).getByKeyPrefix('tag:')
    return tags.map((tag) => applyTranslations(tag, translations, locale))
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM tag WHERE id = ?', id)
  }
}

const validateTagPayload = (payload: TagPayload) => {
  if (!payload.name) throw new Error('Name is required')
  if (!payload.slug) throw new Error('Slug is required')
}

const applyTranslations = (
  tag: TagData,
  translations: Translations,
  locale: string,
): TagData => {
  const localeMap = translations[locale]
  if (!localeMap) return tag
  const prefix = 'tag:' + tag.id + ':'
  return {
    ...tag,
    name: localeMap[prefix + 'name'] ?? tag.name,
  }
}
