'use server'
import { getServices, requireAuth } from '@cms/services/getServices'
import { CategoryPayload, CategoryStore } from '@cms/services/CategoryStore'
import { PostStore } from '@cms/services/PostStore'
import { createServerAction } from '@cms/lib/serverActions'

export const editCategory = createServerAction(
  async (id: string, payload: CategoryPayload): Promise<void> => {
    await requireAuth()
    const db = (await getServices()).db
    await new CategoryStore(db).update(id, payload)
  },
)

export const addCategory = createServerAction(
  async (id: string, payload: CategoryPayload): Promise<void> => {
    await requireAuth()
    const db = (await getServices()).db
    await new CategoryStore(db).add(id, payload)
  },
)

export const deleteCategory = createServerAction(async (id: string): Promise<void> => {
  await requireAuth()
  const db = (await getServices()).db
  await new CategoryStore(db).delete(id)
})

export const movePost = createServerAction(
  async (
    postId: string,
    anchor: { afterId: string } | { beforeId: string } | null,
  ): Promise<void> => {
    await requireAuth()
    const db = (await getServices()).db
    await new PostStore(db).move(postId, anchor)
  },
)
