'use client'

import { FC } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@cms/components/Toast/Toast'
import { SortableRows } from '@cms/components/SortableRows/SortableRows'
import { extractErrorMessage } from '@cms/utils/extractErrorMessage'
import { PostData } from '@cms/services/PostStore'
import { routing } from '@cms/screens/Manage/routing'
import { movePost } from '@cms/screens/Manage/EntityEdit/CategoryEdit/utils'
import { CategoryData } from '@cms/services/CategoryStore'
import { handleServerResult } from '@cms/lib/serverActions'

export const Client: FC<{ posts: PostData[]; categories: CategoryData[] }> = ({
  posts,
  categories,
}) => {
  const router = useRouter()
  const showToast = useToast()

  return (
    <SortableRows<PostData>
      dndId="posts"
      items={posts}
      onMove={async (id, anchor) => {
        try {
          handleServerResult(await movePost(id, anchor))
        } catch (e) {
          showToast('error', extractErrorMessage(e), { timeout: 3000 })
        }
      }}
      onMoveSuccess={() => router.refresh()}
      onMoveError={(e) => showToast('error', extractErrorMessage(e), { timeout: 3000 })}
      emptyMessage={<div className="text-sm italic opacity-50">No posts yet.</div>}
      renderItem={(item) => {
        const category = categories.find((c) => c.id === item.categoryId)
        return (
          <Link
            className="link flex-auto flex flex-row items-center justify-between gap-2"
            href={routing.entityEdit('post', item.id)}
          >
            {item.name}
            <span className="flex-auto" />
            <span className="text-sm text-gray-400">{category?.name ?? '???'}</span>
            <span className="text-sm text-gray-400">{item.createdAt}</span>
            {item.status && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-medium ${item.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {item.status}
              </span>
            )}
          </Link>
        )
      }}
    />
  )
}
