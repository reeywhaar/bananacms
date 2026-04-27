import { and, asc, eq, sql } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import { post, parentPost } from '@cms/lib/db/schema'
import { getShortId } from '@cms/utils/getshortid'
import { BlockData } from '@cms/lib/blocks/declarations'
import { BlockStore } from './BlockStore'
import { LocalizationStore, Translations } from './LocalizationStore'
import { TagStore } from './TagStore'
import { AttributeStore, AttributeData } from './AttributeStore'
import { PostQuery } from './PostQuery'

export type PostData = {
  id: string
  shortid: string
  categoryId: string
  name: string
  slug: string
  createdAt: string
  updatedAt: string
  status: 'published' | 'draft'
}

export type PostPayload = {
  name: string
  slug: string
  categoryId: string
  status: 'published' | 'draft'
  blocks: BlockData[]
  translations: Translations
  tagIds: string[]
  attributes: AttributeData[]
}

const POSITION_EPSILON = 1e-6

export class PostStore {
  constructor(private db: Db) {}

  query(): PostQuery {
    return PostQuery.for(this.db)
  }

  async add(id: string, payload: PostPayload): Promise<void> {
    validatePostPayload(payload)
    if (!payload.categoryId) throw new Error('Category is required')
    await this.db.transaction(async (tx) => {
      await tx.insert(post).values({
        id,
        shortid: getShortId(id),
        name: payload.name,
        slug: payload.slug,
        status: payload.status,
      })
      const topPosition = await topPositionFor(tx, 'category', payload.categoryId)
      await tx.insert(parentPost).values({
        postId: id,
        parentId: payload.categoryId,
        parentTable: 'category',
        position: topPosition,
      })
      await new AttributeStore(tx).saveByParent('post', id, payload.attributes)
      await new BlockStore(tx).saveByParent('post', id, payload.blocks)
      await new LocalizationStore(tx).save('post:' + id + ':', payload.translations)
      await new TagStore(tx).setParent('post', id, payload.tagIds)
    })
  }

  async update(id: string, payload: PostPayload): Promise<void> {
    validatePostPayload(payload)
    await this.db.transaction(async (tx) => {
      await tx
        .update(post)
        .set({
          name: payload.name,
          slug: payload.slug,
          status: payload.status,
          updatedAt: sql`(datetime('now'))`,
        })
        .where(eq(post.id, id))
      const existingParent = await tx
        .select({ parentId: parentPost.parentId, parentTable: parentPost.parentTable })
        .from(parentPost)
        .where(eq(parentPost.postId, id))
        .get()
      const categoryChanged =
        !existingParent ||
        existingParent.parentTable !== 'category' ||
        existingParent.parentId !== payload.categoryId
      if (categoryChanged) {
        const topPosition = await topPositionFor(tx, 'category', payload.categoryId)
        await tx
          .update(parentPost)
          .set({
            parentId: payload.categoryId,
            parentTable: 'category',
            position: topPosition,
          })
          .where(eq(parentPost.postId, id))
      }
      await new LocalizationStore(tx).deleteBlockTranslationsByParentId('post', id)
      await new AttributeStore(tx).saveByParent('post', id, payload.attributes)
      await new BlockStore(tx).saveByParent('post', id, payload.blocks)
      await new LocalizationStore(tx).save('post:' + id + ':', payload.translations)
      await new TagStore(tx).setParent('post', id, payload.tagIds)
    })
  }

  async move(postId: string, afterId: string | null): Promise<void> {
    await this.db.transaction(async (tx) => {
      const current = await tx
        .select({ parentTable: parentPost.parentTable, parentId: parentPost.parentId })
        .from(parentPost)
        .where(eq(parentPost.postId, postId))
        .get()
      if (!current) throw new Error('Post has no parent')

      const fetchSiblings = () =>
        tx
          .select({ postId: parentPost.postId, position: parentPost.position })
          .from(parentPost)
          .where(
            and(
              eq(parentPost.parentTable, current.parentTable),
              eq(parentPost.parentId, current.parentId),
              sql`${parentPost.postId} != ${postId}`,
            ),
          )
          .orderBy(asc(parentPost.position), asc(parentPost.postId))

      const siblings = await fetchSiblings()

      let newPosition: number
      if (afterId === null) {
        newPosition = siblings.length ? siblings[0].position - 1 : 1
      } else {
        const anchorIndex = siblings.findIndex((s) => s.postId === afterId)
        if (anchorIndex === -1) throw new Error('afterId not found in the same parent')
        const anchor = siblings[anchorIndex]
        const next = siblings[anchorIndex + 1]
        if (!next) {
          newPosition = anchor.position + 1
        } else if (next.position - anchor.position < POSITION_EPSILON) {
          await rebalance(tx, current.parentTable, current.parentId)
          const rebalanced = await fetchSiblings()
          const idx = rebalanced.findIndex((s) => s.postId === afterId)
          const a = rebalanced[idx]
          const n = rebalanced[idx + 1]
          newPosition = n ? (a.position + n.position) / 2 : a.position + 1
        } else {
          newPosition = (anchor.position + next.position) / 2
        }
      }

      await tx
        .update(parentPost)
        .set({ position: newPosition })
        .where(eq(parentPost.postId, postId))
    })
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(post).where(eq(post.id, id))
  }
}

async function topPositionFor(tx: Db, parentTable: string, parentId: string): Promise<number> {
  const row = await tx
    .select({ min: sql<number | null>`MIN(${parentPost.position})` })
    .from(parentPost)
    .where(and(eq(parentPost.parentTable, parentTable), eq(parentPost.parentId, parentId)))
    .get()
  const min = row?.min
  return min == null ? 1 : min - 1
}

async function rebalance(tx: Db, parentTable: string, parentId: string): Promise<void> {
  const rows = await tx
    .select({ postId: parentPost.postId })
    .from(parentPost)
    .where(and(eq(parentPost.parentTable, parentTable), eq(parentPost.parentId, parentId)))
    .orderBy(asc(parentPost.position), asc(parentPost.postId))
  for (let i = 0; i < rows.length; i++) {
    await tx
      .update(parentPost)
      .set({ position: i + 1 })
      .where(eq(parentPost.postId, rows[i].postId))
  }
}

const validatePostPayload = (payload: PostPayload) => {
  if (!payload.name) throw new Error('Name is required')
  if (!payload.slug) throw new Error('Slug is required')
  if (!payload.categoryId) throw new Error('Category is required')
}
