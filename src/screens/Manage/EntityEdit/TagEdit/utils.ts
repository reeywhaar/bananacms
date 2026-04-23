'use server'
import { getServices } from '@cms/services/getServices'
import { TagPayload, TagStore } from '@cms/services/TagStore'

export const editTag = async (id: string, payload: TagPayload): Promise<void> => {
  const db = (await getServices()).db
  await new TagStore(db).update(id, payload)
}

export const addTag = async (id: string, payload: TagPayload): Promise<void> => {
  const db = (await getServices()).db
  await new TagStore(db).add(id, payload)
}

export const deleteTag = async (id: string): Promise<void> => {
  const db = (await getServices()).db
  await new TagStore(db).delete(id)
}
