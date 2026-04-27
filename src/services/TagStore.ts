import { and, eq, sql } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import { tag, parentTag } from '@cms/lib/db/schema'
import { getShortId } from '@cms/utils/getshortid'
import { LocalizationStore, Translations } from './LocalizationStore'
import { TagQuery } from './TagQuery'

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
  constructor(private db: Db) {}

  query(): TagQuery {
    return TagQuery.for(this.db)
  }

  async setParent(parentTable: string, parentId: string, tagIds: string[]): Promise<void> {
    await this.db
      .delete(parentTag)
      .where(and(eq(parentTag.parentTable, parentTable), eq(parentTag.parentId, parentId)))
    for (const tagId of tagIds) {
      await this.db.insert(parentTag).values({ tagId, parentId, parentTable })
    }
  }

  async add(id: string, payload: TagPayload): Promise<void> {
    validateTagPayload(payload)
    await this.db.insert(tag).values({
      id,
      shortid: getShortId(id),
      name: payload.name,
      slug: payload.slug,
    })
    await new LocalizationStore(this.db).save('tag:' + id + ':', payload.translations)
  }

  async update(id: string, payload: TagPayload): Promise<void> {
    validateTagPayload(payload)
    await this.db
      .update(tag)
      .set({
        name: payload.name,
        slug: payload.slug,
        updatedAt: sql`(datetime('now'))`,
      })
      .where(eq(tag.id, id))
    await new LocalizationStore(this.db).save('tag:' + id + ':', payload.translations)
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(tag).where(eq(tag.id, id))
  }
}

const validateTagPayload = (payload: TagPayload) => {
  if (!payload.name) throw new Error('Name is required')
  if (!payload.slug) throw new Error('Slug is required')
}
