import { eq } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import { page } from '@cms/lib/db/schema'
import { BlockData } from '@cms/lib/blocks/declarations'
import { BlockStore } from './BlockStore'
import { LocalizationStore, Translations } from './LocalizationStore'
import { AttributeStore, AttributeData } from './AttributeStore'
import { PageQuery } from './PageQuery'

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
  constructor(private db: Db) {}

  query(): PageQuery {
    return PageQuery.for(this.db)
  }

  async add(id: string, payload: PagePayload): Promise<void> {
    validatePagePayload(payload)
    await this.db.transaction(async (tx) => {
      await tx.insert(page).values({ id, key: payload.key })
      await new AttributeStore(tx).saveByParent('page', id, payload.attributes)
      await new BlockStore(tx).saveByParent('page', id, payload.blocks)
      await new LocalizationStore(tx).save('page:' + id + ':', payload.translations)
    })
  }

  async update(id: string, payload: PagePayload): Promise<void> {
    validatePagePayload(payload)
    await this.db.transaction(async (tx) => {
      await tx.update(page).set({ key: payload.key }).where(eq(page.id, id))
      await new LocalizationStore(tx).deleteBlockTranslationsByParentId('page', id)
      await new AttributeStore(tx).saveByParent('page', id, payload.attributes)
      await new BlockStore(tx).saveByParent('page', id, payload.blocks)
      await new LocalizationStore(tx).save('page:' + id + ':', payload.translations)
    })
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(page).where(eq(page.id, id))
  }
}

const validatePagePayload = (payload: PagePayload) => {
  if (!payload.key) throw new Error('Key is required')
}
