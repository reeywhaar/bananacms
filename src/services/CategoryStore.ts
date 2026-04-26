import { Database } from 'sqlite'
import { BlockStore } from './BlockStore'
import { LocalizationStore, Translations } from './LocalizationStore'
import { AttributeStore, AttributeData } from './AttributeStore'
import { getShortId } from '@cms/utils/getshortid'
import { BlockData } from '@cms/lib/blocks/declarations'
import { valita } from '@cms/utils/valita'
import {
  GetByParentOptionsBase,
  allQueryVariantSchema,
  columnQueryVariantSchema,
  parseIdentifier,
  sqlOrder,
} from './getByParentQuery'

const categoryChildColumnSchema = valita.union(
  valita.literal('id'),
  valita.literal('shortid'),
  valita.literal('slug'),
)
const categoryQuerySchema = valita.union(
  allQueryVariantSchema(),
  columnQueryVariantSchema(categoryChildColumnSchema),
)
const categoryOrderFieldSchema = valita.union(
  valita.literal('name'),
  valita.literal('id'),
  valita.literal('slug'),
)

export type CategoryQuery = valita.Infer<typeof categoryQuerySchema>
export type CategoryOrderField = valita.Infer<typeof categoryOrderFieldSchema>
export type CategoryGetOptions = GetByParentOptionsBase<CategoryOrderField>

const CATEGORY_CHILD_COLUMNS: Record<valita.Infer<typeof categoryChildColumnSchema>, string> = {
  id: 'c.id',
  shortid: 'c.shortid',
  slug: 'c.slug',
}
const CATEGORY_ORDER_FIELDS: Record<CategoryOrderField, string> = {
  name: 'c.name',
  id: 'c.id',
  slug: 'c.slug',
}

const conditionToSql = (c: 'eq' | 'neq' | 'like'): string =>
  c === 'eq' ? '=' : c === 'neq' ? '!=' : 'LIKE'

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

export class CategoryStore {
  constructor(private db: Database) {}

  async get(query: CategoryQuery, options: CategoryGetOptions = {}): Promise<CategoryData[]> {
    parseIdentifier(categoryQuerySchema, query, 'query')
    if (options.order)
      parseIdentifier(categoryOrderFieldSchema, options.order.field, 'order.field')
    if (query.type === 'column' && !query.value) return []

    const selectColumns = options.locale
      ? `c.id, c.shortid, c.slug, COALESCE(l.text, c.name) AS name, COUNT(pp.postId) AS postCount`
      : `c.id, c.shortid, c.slug, c.name, COUNT(pp.postId) AS postCount`

    const orderBy = options.order
      ? `${CATEGORY_ORDER_FIELDS[options.order.field]} ${sqlOrder(options.order.order)}`
      : `c.id ASC`

    const params: unknown[] = []
    const lines: string[] = [
      `SELECT ${selectColumns}`,
      `  FROM category c`,
      `  LEFT JOIN parent_post pp ON pp.parentTable = 'category' AND pp.parentId = c.id`,
    ]
    if (options.locale) {
      lines.push(
        `  LEFT JOIN localizations l ON l.key = 'category:' || c.id || ':name' AND l.locale = ?`,
      )
      params.push(options.locale)
    }
    if (query.type === 'column') {
      lines.push(
        ` WHERE ${CATEGORY_CHILD_COLUMNS[query.column]} ${conditionToSql(query.condition ?? 'eq')} ?`,
      )
      params.push(query.value)
    }
    lines.push(' GROUP BY c.id')
    lines.push(` ORDER BY ${orderBy}`)
    if (options.limit !== undefined) {
      lines.push(' LIMIT ?')
      params.push(options.limit)
      if (options.offset !== undefined) {
        lines.push(' OFFSET ?')
        params.push(options.offset)
      }
    }
    return this.db.all<CategoryData[]>(lines.join('\n'), ...params)
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
      await new AttributeStore(this.db).saveByParent('category', id, payload.attributes)
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
      await new AttributeStore(this.db).saveByParent('category', id, payload.attributes)
      await new BlockStore(this.db).saveByParent('category', id, payload.blocks)
      await new LocalizationStore(this.db).save('category:' + id + ':', payload.translations)
      await this.db.run('COMMIT')
    } catch (e) {
      await this.db.run('ROLLBACK')
      throw e
    }
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM category WHERE id = ?', id)
  }
}

const validateCategoryPayload = (payload: CategoryPayload) => {
  if (!payload.name) throw new Error('Name is required')
  if (!payload.slug) throw new Error('Slug is required')
}
