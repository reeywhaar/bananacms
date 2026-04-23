'use server'

import { getServices } from '@cms/services/getServices'
import { PostPayload, PostStore } from '@cms/services/PostStore'

export const editPost = async (id: string, payload: PostPayload): Promise<void> => {
  const db = (await getServices()).db
  await new PostStore(db).update(id, payload)
}

export const addPost = async (id: string, payload: PostPayload): Promise<void> => {
  const db = (await getServices()).db
  await new PostStore(db).add(id, payload)
}

export const deletePost = async (id: string): Promise<void> => {
  const db = (await getServices()).db
  await new PostStore(db).delete(id)
}
