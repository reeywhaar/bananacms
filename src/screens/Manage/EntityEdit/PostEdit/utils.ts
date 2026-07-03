'use server'

import { createServerAction } from '@cms/lib/serverActions'
import { getServices, requireAuth } from '@cms/services/getServices'
import { PostPayload, PostStore } from '@cms/services/PostStore'
import { PostSearchStore } from '@cms/services/PostSearchStore'

export const editPost = createServerAction(
  async (id: string, payload: PostPayload): Promise<void> => {
    await requireAuth()
    const { db } = await getServices()
    await new PostStore(db).update(id, payload)
    await new PostSearchStore(db).rebuildPostIndex(id)
  },
)

export const addPost = createServerAction(
  async (id: string, payload: PostPayload): Promise<void> => {
    await requireAuth()
    const { db } = await getServices()
    await new PostStore(db).add(id, payload)
    await new PostSearchStore(db).rebuildPostIndex(id)
  },
)

export const deletePost = createServerAction(async (id: string): Promise<void> => {
  await requireAuth()
  const { db } = await getServices()
  await new PostSearchStore(db).deletePostIndex(id)
  await new PostStore(db).delete(id)
})
