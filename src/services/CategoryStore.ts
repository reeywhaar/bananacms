import { eq } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import { category } from '@cms/lib/db/schema'
import { getShortId } from '@cms/utils/getshortid'
import { BlockData } from '@cms/lib/blocks/declarations'
import { BlockStore } from './BlockStore'
import { LocalizationStore, Translations } from './LocalizationStore'
import { AttributeStore, AttributeData } from './AttributeStore'
import { CategoryQuery } from './CategoryQuery'

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
  constructor(private db: Db) {}

  query(): CategoryQuery {
    return CategoryQuery.for(this.db)
  }

  async add(id: string, payload: CategoryPayload): Promise<void> {
    validateCategoryPayload(payload)
    await this.db.transaction(async (tx) => {
      await tx
        .insert(category)
        .values({ id, shortid: getShortId(id), name: payload.name, slug: payload.slug })
      await new AttributeStore(tx).saveByParent('category', id, payload.attributes)
      await new BlockStore(tx).saveByParent('category', id, payload.blocks)
      await new LocalizationStore(tx).save('category:' + id + ':', payload.translations)
    })
  }

  async update(id: string, payload: CategoryPayload): Promise<void> {
    validateCategoryPayload(payload)
    await this.db.transaction(async (tx) => {
      await tx
        .update(category)
        .set({ name: payload.name, slug: payload.slug })
        .where(eq(category.id, id))
      await new LocalizationStore(tx).deleteBlockTranslationsByParentId('category', id)
      await new AttributeStore(tx).saveByParent('category', id, payload.attributes)
      await new BlockStore(tx).saveByParent('category', id, payload.blocks)
      await new LocalizationStore(tx).save('category:' + id + ':', payload.translations)
    })
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(category).where(eq(category.id, id))
  }
}

const validateCategoryPayload = (payload: CategoryPayload) => {
  if (!payload.name) throw new Error('Name is required')
  if (!payload.slug) throw new Error('Slug is required')
}
