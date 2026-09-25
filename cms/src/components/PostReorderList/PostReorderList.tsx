import type { FC } from 'react'
import type { Context } from '../../framework/context.ts'
import type { PostData } from '../../services/PostStore.ts'
import { CategoryStore } from '../../stores.ts'
import { Client } from './Client.tsx'
import { getDb } from '../../framework/context.ts'

export const PostReorderList: FC<{ ctx: Context; posts: PostData[] }> = async ({ ctx, posts }) => {
  const categoryStore = new CategoryStore(getDb(ctx))
  const categories = await categoryStore.query().all()

  return <Client posts={posts} categories={categories} />
}
