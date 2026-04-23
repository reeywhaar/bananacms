'use server'
import { getServices } from '@cms/services/getServices'
import { CategoryPayload, CategoryStore } from '@cms/services/CategoryStore'
import { PostStore } from '@cms/services/PostStore'

export const editCategory = async (id: string, payload: CategoryPayload): Promise<void> => {
  const db = (await getServices()).db
  await new CategoryStore(db).update(id, payload)
}

export const addCategory = async (id: string, payload: CategoryPayload): Promise<void> => {
  const db = (await getServices()).db
  await new CategoryStore(db).add(id, payload)
}

export const deleteCategory = async (id: string): Promise<void> => {
  const db = (await getServices()).db
  await new CategoryStore(db).delete(id)
}

export const movePost = async (postId: string, afterId: string | null): Promise<void> => {
  const db = (await getServices()).db
  await new PostStore(db).move(postId, afterId)
}
