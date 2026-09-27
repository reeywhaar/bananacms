import type { FC } from 'react'
import type { Context } from '#cms/framework/context.ts'
import type { PostData } from '#cms/services/PostStore.ts'
import { CategoryStore, TagStore } from '#cms/stores.ts'
import { Client } from './Client.tsx'
import { getDb } from '#cms/framework/context.ts'

export const PostReorderList: FC<{ ctx: Context; posts: PostData[] }> = async ({ ctx, posts }) => {
  const db = getDb(ctx)
  const [categories, tagsByPost] = await Promise.all([
    new CategoryStore(db).query().all(),
    new TagStore(db).getByParents(
      'post',
      posts.map((post) => post.id),
    ),
  ])

  return <Client posts={posts} categories={categories} tagsByPost={tagsByPost} />
}
