'use server'

import { getServices } from '@cms/services/getServices'
import { PagePayload, PageStore } from '@cms/services/PageStore'

export const editPage = async (id: string, payload: PagePayload): Promise<void> => {
  const db = (await getServices()).db
  await new PageStore(db).update(id, payload)
}

export const addPage = async (id: string, payload: PagePayload): Promise<void> => {
  const db = (await getServices()).db
  await new PageStore(db).add(id, payload)
}

export const deletePage = async (id: string): Promise<void> => {
  const db = (await getServices()).db
  await new PageStore(db).delete(id)
}
