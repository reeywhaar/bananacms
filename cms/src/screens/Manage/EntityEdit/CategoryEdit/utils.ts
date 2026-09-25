'use server'
import { type CategoryPayload, CategoryStore } from '../../../../services/CategoryStore.ts'
import { PostStore } from '../../../../services/PostStore.ts'
import { adminAction } from '../../../../lib/adminAction.ts'
import { getDb } from '../../../../framework/context.ts'

export const editCategory = adminAction(
  async (ctx, id: string, payload: CategoryPayload): Promise<void> => {
    const db = getDb(ctx)
    await new CategoryStore(db).update(id, payload)
  },
)

export const addCategory = adminAction(
  async (ctx, id: string, payload: CategoryPayload): Promise<void> => {
    const db = getDb(ctx)
    await new CategoryStore(db).add(id, payload)
  },
)

export const deleteCategory = adminAction(async (ctx, id: string): Promise<void> => {
  const db = getDb(ctx)
  await new CategoryStore(db).delete(id)
})

export const movePost = adminAction(
  async (
    ctx,
    postId: string,
    anchor: { afterId: string } | { beforeId: string } | null,
  ): Promise<void> => {
    const db = getDb(ctx)
    await new PostStore(db).move(postId, anchor)
  },
)
