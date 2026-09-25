'use client'

import type { FC } from 'react'
import { useRouter } from '../../framework/navigation.ts'
import { Link } from '../../framework/link.tsx'
import { useToast } from '../Toast/Toast.tsx'
import { SortableRows } from '../SortableRows/SortableRows.tsx'
import { extractErrorMessage } from '../../utils/extractErrorMessage.ts'
import type { PostData } from '../../services/PostStore.ts'
import { routing } from '../../screens/Manage/routing.ts'
import { movePost } from '../../screens/Manage/EntityEdit/CategoryEdit/utils.ts'
import type { CategoryData } from '../../services/CategoryStore.ts'
import { handleServerResult } from '../../lib/serverActions.ts'

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
          <>
            <Link
              className="link min-w-[150px] truncate text-sm md:text-base"
              href={routing.entityEdit('post', item.id)}
            >
              {item.name}
            </Link>
            <div className="overflow-x-auto flex flex-row items-center gap-2">
              {category ? (
                <Link
                  className="link text-sm whitespace-nowrap"
                  href={routing.entityShow('category', category.id)}
                >
                  {category.name}
                </Link>
              ) : (
                <span className="text-sm text-gray-400 whitespace-nowrap">???</span>
              )}
              <span className="text-sm text-gray-400 whitespace-nowrap">{item.createdAt}</span>
              {item.status && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${item.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {item.status}
                </span>
              )}
            </div>
          </>
        )
      }}
    />
  )
}
