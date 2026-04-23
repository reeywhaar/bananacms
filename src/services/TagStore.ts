import { Database } from 'sqlite'
import { LocalizationStore, Translations } from './LocalizationStore'
import { getShortId } from '@cms/utils/getshortid'

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

  async getByParent(parentTable: string, parentId: string): Promise<TagData[]> {
    const rows = await this.db.all<TagData[]>(
      `SELECT t.id, t.shortid, t.slug, t.name
         FROM tag t
         JOIN parent_tag pt ON pt.tagId = t.id
        WHERE pt.parentTable = ? AND pt.parentId = ?
        ORDER BY t.name`,
      parentTable,
      parentId,
    )
    return rows
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
