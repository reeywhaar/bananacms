import { Database } from 'sqlite'
import { BlockStore } from './BlockStore'
import { LocalizationStore, Translations } from './LocalizationStore'
import { AttributeStore, AttributeData } from './AttributeStore'
import { BlockData } from '@cms/lib/blocks/declarations'
import { valita } from '@cms/utils/valita'
import {
  GetByParentOptionsBase,
  allQueryVariantSchema,
  columnQueryVariantSchema,
  parseIdentifier,
  sqlOrder,
} from './getByParentQuery'

const pageChildColumnSchema = valita.union(valita.literal('id'), valita.literal('key'))
const pageQuerySchema = valita.union(
  allQueryVariantSchema(),
  columnQueryVariantSchema(pageChildColumnSchema),
)
const pageOrderFieldSchema = valita.union(valita.literal('id'), valita.literal('key'))

export type PageQuery = valita.Infer<typeof pageQuerySchema>
export type PageOrderField = valita.Infer<typeof pageOrderFieldSchema>
export type PageGetOptions = GetByParentOptionsBase<PageOrderField>

const PAGE_CHILD_COLUMNS: Record<valita.Infer<typeof pageChildColumnSchema>, string> = {
  id: 'p.id',
  key: 'p.key',
}
const PAGE_ORDER_FIELDS: Record<PageOrderField, string> = {
  id: 'p.id',
  key: 'p.key',
}

const conditionToSql = (c: 'eq' | 'neq' | 'like'): string =>
  c === 'eq' ? '=' : c === 'neq' ? '!=' : 'LIKE'

export type PageData = {
  id: string
  key: string
  name: string
}

export type PagePayload = {
  key: string
  blocks: BlockData[]
  translations: Translations
  attributes: AttributeData[]
}

export class PageStore {
  constructor(private db: Database) {}

  async get(query: PageQuery, options: PageGetOptions = {}): Promise<PageData[]> {
    parseIdentifier(pageQuerySchema, query, 'query')
    if (options.order) parseIdentifier(pageOrderFieldSchema, options.order.field, 'order.field')
    if (query.type === 'column' && !query.value) return []

    const orderBy = options.order
      ? `${PAGE_ORDER_FIELDS[options.order.field]} ${sqlOrder(options.order.order)}`
      : `p.key ASC`

    const params: unknown[] = []
    const lines: string[] = [`SELECT p.id, p.key, p.key AS name FROM page p`]
    if (query.type === 'column') {
      lines.push(
        ` WHERE ${PAGE_CHILD_COLUMNS[query.column]} ${conditionToSql(query.condition ?? 'eq')} ?`,
      )
      params.push(query.value)
    }
    lines.push(` ORDER BY ${orderBy}`)
    if (options.limit !== undefined) {
      lines.push(' LIMIT ?')
      params.push(options.limit)
      if (options.offset !== undefined) {
        lines.push(' OFFSET ?')
        params.push(options.offset)
      }
    }
    return this.db.all<PageData[]>(lines.join('\n'), ...params)
  }

  async add(id: string, payload: PagePayload): Promise<void> {
    validatePagePayload(payload)
    await this.db.run('BEGIN TRANSACTION')
    try {
      await this.db.run('INSERT INTO page (id, key) VALUES (?, ?)', id, payload.key)
      await new AttributeStore(this.db).saveByParent('page', id, payload.attributes)
      await new BlockStore(this.db).saveByParent('page', id, payload.blocks)
      await new LocalizationStore(this.db).save('page:' + id + ':', payload.translations)
      await this.db.run('COMMIT')
    } catch (e) {
      await this.db.run('ROLLBACK')
      throw e
    }
  }

  async update(id: string, payload: PagePayload): Promise<void> {
    validatePagePayload(payload)
    await this.db.run('BEGIN TRANSACTION')
    try {
      await this.db.run('UPDATE page SET key = ? WHERE id = ?', payload.key, id)
      await new LocalizationStore(this.db).deleteBlockTranslationsByParentId('page', id)
      await new AttributeStore(this.db).saveByParent('page', id, payload.attributes)
      await new BlockStore(this.db).saveByParent('page', id, payload.blocks)
      await new LocalizationStore(this.db).save('page:' + id + ':', payload.translations)
      await this.db.run('COMMIT')
    } catch (e) {
      await this.db.run('ROLLBACK')
      throw e
    }
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM page WHERE id = ?', id)
  }
}

const validatePagePayload = (payload: PagePayload) => {
  if (!payload.key) throw new Error('Key is required')
}
