'use server'
import { and, eq } from 'drizzle-orm'
import { getServices, requireAuth } from '@cms/services/getServices'
import { TagPayload, TagStore } from '@cms/services/TagStore'
import { parentTag } from '@cms/lib/db/schema'
import { createServerAction } from '@cms/lib/serverActions'

export const editTag = createServerAction(
  async (id: string, payload: TagPayload): Promise<void> => {
    await requireAuth()
    const { db, postSearchStore } = await getServices()
    await new TagStore(db).update(id, payload)
    await postSearchStore.rebuildPostsWithTag(id)
  },
)

export const addTag = createServerAction(async (id: string, payload: TagPayload): Promise<void> => {
  await requireAuth()
  const db = (await getServices()).db
  await new TagStore(db).add(id, payload)
})

export const deleteTag = createServerAction(async (id: string): Promise<void> => {
  await requireAuth()
  const { db, postSearchStore } = await getServices()
  // Capture affected post IDs before cascade delete removes parent_tag rows
  const rows = await db
    .select({ postId: parentTag.parentId })
    .from(parentTag)
    .where(and(eq(parentTag.tagId, id), eq(parentTag.parentTable, 'post')))
  await new TagStore(db).delete(id)
  for (const { postId } of rows) {
    await postSearchStore.rebuildPostIndex(postId)
  }
})
