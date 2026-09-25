'use server'

import { and, eq } from 'drizzle-orm'
import { type TagPayload, TagStore } from '../../../../services/TagStore.ts'
import { parentTag } from '../../../../lib/db/schema.ts'
import { adminAction } from '../../../../lib/adminAction.ts'
import { PostSearchStore } from '../../../../services/PostSearchStore.ts'
import { getDb } from '../../../../framework/context.ts'

export const editTag = adminAction(async (ctx, id: string, payload: TagPayload): Promise<void> => {
  const db = getDb(ctx)
  await new TagStore(db).update(id, payload)
  await new PostSearchStore(db).rebuildPostsWithTag(id)
})

export const addTag = adminAction(async (ctx, id: string, payload: TagPayload): Promise<void> => {
  const db = getDb(ctx)
  await new TagStore(db).add(id, payload)
})

export const deleteTag = adminAction(async (ctx, id: string): Promise<void> => {
  const db = getDb(ctx)
  // Capture affected post IDs before cascade delete removes parent_tag rows
  const rows = await db
    .select({ postId: parentTag.parentId })
    .from(parentTag)
    .where(and(eq(parentTag.tagId, id), eq(parentTag.parentTable, 'post')))
  await new TagStore(db).delete(id)
  for (const { postId } of rows) {
    await new PostSearchStore(db).rebuildPostIndex(postId)
  }
})
