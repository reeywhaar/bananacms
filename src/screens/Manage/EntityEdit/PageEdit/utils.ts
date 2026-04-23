'use server'

import { createServerAction } from '@cms/lib/serverActions'
import { getServices, requireAuth } from '@cms/services/getServices'
import { PagePayload, PageStore } from '@cms/services/PageStore'

export const editPage = createServerAction(
  async (id: string, payload: PagePayload): Promise<void> => {
    await requireAuth()
    const db = (await getServices()).db
    await new PageStore(db).update(id, payload)
  },
)

export const addPage = createServerAction(
  async (id: string, payload: PagePayload): Promise<void> => {
    await requireAuth()
    const db = (await getServices()).db
    await new PageStore(db).add(id, payload)
  },
)

export const deletePage = createServerAction(async (id: string): Promise<void> => {
  await requireAuth()
  const db = (await getServices()).db
  await new PageStore(db).delete(id)
})
