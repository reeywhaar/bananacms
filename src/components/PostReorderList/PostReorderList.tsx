import { FC } from 'react'
import { Client } from './Client'
import { PostData } from '@cms/services/PostStore'
import { CategoryStore } from '@cms/stores'
import { getServices } from '@cms/runtime'

export const PostReorderList: FC<{ posts: PostData[] }> = async ({ posts }) => {
  const services = await getServices()
  const categoryStore = new CategoryStore(services.db)
  const categories = await categoryStore.query().all()

  return <Client posts={posts} categories={categories} />
}
