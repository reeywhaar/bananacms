'use client'

import type { FC } from 'react'
import { useRouter } from '#cms/framework/navigation.ts'
import { Link } from '#cms/framework/link.tsx'
import { useToast } from '../Toast/Toast.tsx'
import { SortableRows } from '../SortableRows/SortableRows.tsx'
import { extractErrorMessage } from '#cms/utils/extractErrorMessage.ts'
import type { PostData } from '#cms/services/PostStore.ts'
import { routing } from '#cms/screens/Manage/routing.ts'
import { movePost } from '#cms/screens/Manage/EntityEdit/CategoryEdit/utils.ts'
import type { CategoryData } from '#cms/services/CategoryStore.ts'
import type { TagData } from '#cms/services/TagStore.ts'
import { handleServerResult } from '#cms/lib/serverActions.ts'

// A card per post: its name and status, and under them its category, date and
// tags.
export const Client: FC<{
  posts: PostData[]
  categories: CategoryData[]
  tagsByPost: Record<string, TagData[]>
}> = ({ posts, categories, tagsByPost }) => {
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
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                className="link truncate font-medium"
                href={routing.entityEdit('post', item.id)}
              >
                {item.name}
              </Link>
              {item.status && (
                <span
                  className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${item.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {item.status}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
              {category ? (
                <Link className="link" href={routing.entityShow('category', category.id)}>
                  {category.name}
                </Link>
              ) : (
                <span className="text-gray-400">???</span>
              )}
              <span className="whitespace-nowrap">{item.createdAt}</span>
              {(tagsByPost[item.id] ?? []).length > 0 && (
                <span className="flex flex-wrap gap-1">
                  {tagsByPost[item.id].map((tag) => (
                    <Link
                      key={tag.id}
                      className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 hover:bg-accent-100"
                      href={routing.entityShow('tag', tag.id)}
                    >
                      {tag.name}
                    </Link>
                  ))}
                </span>
              )}
            </div>
          </div>
        )
      }}
    />
  )
}
