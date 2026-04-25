import { Database } from 'sqlite'
import { BlockStore } from './BlockStore'
import { LocalizationStore, Translations } from './LocalizationStore'
import { AttributeStore, AttributeData } from './AttributeStore'
import { BlockData } from '@cms/lib/blocks/declarations'

export type PageData = {
  id: string
  key: string
}

export type PagePayload = {
  key: string
  blocks: BlockData[]
  translations: Translations
  attributes: AttributeData[]
}

export class PageStore {
  constructor(private db: Database) {}

  async get(id: string): Promise<PageData | null> {
    const row = await this.db.get<PageData>('SELECT id, key FROM page WHERE id = ?', id)
    return row || null
  }

  async getByKey(key: string): Promise<PageData | null> {
    const row = await this.db.get<PageData>('SELECT id, key FROM page WHERE key = ?', key)
    return row || null
  }

  async getAll(): Promise<(PageData & { name: string })[]> {
    return this.db.all<(PageData & { name: string })[]>(
      'SELECT id, key, key AS name FROM page ORDER BY key',
    )
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
