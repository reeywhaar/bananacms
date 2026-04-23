import { Database } from 'sqlite'
import { BlockStore } from './BlockStore'
import { LocalizationStore, Translations } from './LocalizationStore'
import { getShortId } from '@cms/utils/getshortid'
import { BlockData } from '@cms/lib/blocks/declarations'
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
}

export class CategoryStore {
  constructor(private db: Database) {}

  async get(id: string): Promise<CategoryData | null> {
    const row = await this.db.get<CategoryData>(
      'SELECT id, shortid, slug, name FROM category WHERE id = ?',
      id,
    )
    return row || null
  }

  async getAll(): Promise<CategoryData[]> {
    const rows = await this.db.all<CategoryData[]>(
      `SELECT c.id, c.shortid, c.slug, c.name, COUNT(pp.postId) AS postCount
         FROM category c
         LEFT JOIN parent_post pp ON pp.parentTable = 'category' AND pp.parentId = c.id
         GROUP BY c.id
         ORDER BY c.id`,
    )
    return rows
  }

  async add(id: string, payload: CategoryPayload): Promise<void> {
    validateCategoryPayload(payload)
    await this.db.run('BEGIN TRANSACTION')
    try {
      await this.db.run(
        'INSERT INTO category (id, shortid, name, slug) VALUES (?, ?, ?, ?)',
        id,
        getShortId(id),
        payload.name,
        payload.slug,
      )
      await new BlockStore(this.db).saveByParent('category', id, payload.blocks)
      await new LocalizationStore(this.db).save('category:' + id + ':', payload.translations)
      await this.db.run('COMMIT')
    } catch (e) {
      await this.db.run('ROLLBACK')
      throw e
    }
  }

  async update(id: string, payload: CategoryPayload): Promise<void> {
    validateCategoryPayload(payload)
    await this.db.run('BEGIN TRANSACTION')
    try {
      await this.db.run(
        'UPDATE category SET name = ?, slug = ? WHERE id = ?',
        payload.name,
        payload.slug,
        id,
      )
      await new LocalizationStore(this.db).deleteBlockTranslationsByParentId('category', id)
      await new BlockStore(this.db).saveByParent('category', id, payload.blocks)
      await new LocalizationStore(this.db).save('category:' + id + ':', payload.translations)
      await this.db.run('COMMIT')
    } catch (e) {
      await this.db.run('ROLLBACK')
      throw e
    }
  }

  async getPublicById(locale: string, id: string): Promise<CategoryData | null> {
    const category = await this.get(id)
    if (!category) return null
    const translations = await new LocalizationStore(this.db).getByKeyPrefix('category:' + id + ':')
    return applyTranslations(category, translations, locale)
  }

  async getPublicByShortId(locale: string, shortid: string): Promise<CategoryData | null> {
    const category = await this.db.get<CategoryData>(
      'SELECT id, shortid, slug, name FROM category WHERE shortid = ?',
      shortid,
    )
    if (!category) return null
    const translations = await new LocalizationStore(this.db).getByKeyPrefix(
      'category:' + category.id + ':',
    )
    return applyTranslations(category, translations, locale)
  }

  async getPublicAll(locale: string): Promise<CategoryData[]> {
    const categories = await this.getAll()
    const translations = await new LocalizationStore(this.db).getByKeyPrefix('category:')
    return categories.map((category) => applyTranslations(category, translations, locale))
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM category WHERE id = ?', id)
  }
}

const validateCategoryPayload = (payload: CategoryPayload) => {
  if (!payload.name) throw new Error('Name is required')
  if (!payload.slug) throw new Error('Slug is required')
}

const applyTranslations = (
  category: CategoryData,
  translations: Translations,
  locale: string,
): CategoryData => {
  const localeMap = translations[locale]
  if (!localeMap) return category
  const prefix = 'category:' + category.id + ':'
  return {
    ...category,
    name: localeMap[prefix + 'name'] ?? category.name,
  }
}
