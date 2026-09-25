'use server'

import { adminAction } from '../../../../lib/adminAction.ts'
import { type PagePayload, PageStore } from '../../../../services/PageStore.ts'
import { getDb } from '../../../../framework/context.ts'

export const editPage = adminAction(
  async (ctx, id: string, payload: PagePayload): Promise<void> => {
    const db = getDb(ctx)
    await new PageStore(db).update(id, payload)
  },
)

export const addPage = adminAction(async (ctx, id: string, payload: PagePayload): Promise<void> => {
  const db = getDb(ctx)
  await new PageStore(db).add(id, payload)
})

export const deletePage = adminAction(async (ctx, id: string): Promise<void> => {
  const db = getDb(ctx)
  await new PageStore(db).delete(id)
})
