'use server'

import { adminAction } from '../../../../lib/adminAction.ts'
import { type PostPayload, PostStore } from '../../../../services/PostStore.ts'
import { PostSearchStore } from '../../../../services/PostSearchStore.ts'
import { getDb } from '../../../../framework/context.ts'

export const editPost = adminAction(
  async (ctx, id: string, payload: PostPayload): Promise<void> => {
    const db = getDb(ctx)
    await new PostStore(db).update(id, payload)
    await new PostSearchStore(db).rebuildPostIndex(id)
  },
)

export const addPost = adminAction(async (ctx, id: string, payload: PostPayload): Promise<void> => {
  const db = getDb(ctx)
  await new PostStore(db).add(id, payload)
  await new PostSearchStore(db).rebuildPostIndex(id)
})

export const deletePost = adminAction(async (ctx, id: string): Promise<void> => {
  const db = getDb(ctx)
  await new PostSearchStore(db).deletePostIndex(id)
  await new PostStore(db).delete(id)
})
