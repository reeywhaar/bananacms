'use client'

import type { FC } from 'react'
import { Link } from '#cms/framework/link.tsx'
import { useRouter } from '#cms/framework/navigation.ts'
import { routing } from '#cms/screens/Manage/routing.ts'
import { deletePage } from '#cms/screens/Manage/EntityEdit/PageEdit/utils.ts'
import type { EntityListItem } from '#cms/lib/entities.ts'
import { handleServerResult } from '#cms/lib/serverActions.ts'
import { extractErrorMessage } from '#cms/utils/extractErrorMessage.ts'
import { useToast } from '../Toast/Toast.tsx'
import { useWithProgress } from '../ProgressOverlay/ProgressOverlay.tsx'
import { Menu } from '../Menu/Menu.tsx'
import { useConfirm } from '../Confirm/Confirm.tsx'

// A card per page, its key, all of it a link to the page's editor but its menu,
// which duplicates it, opening a new page that's a copy of it, or deletes it.
export const PageList: FC<{ pages: EntityListItem[] }> = ({ pages }) => {
  const router = useRouter()
  const showToast = useToast()
  const withProgress = useWithProgress()
  const confirm = useConfirm()

  const remove = async (page: EntityListItem) => {
    if (
      !(await confirm({
        title: `Delete “${page.name}”?`,
        message: 'This cannot be undone.',
        action: 'Delete',
        danger: true,
      }))
    )
      return
    withProgress(async () => {
      try {
        handleServerResult(await deletePage(page.id))
        router.refresh()
      } catch (e) {
        showToast('error', extractErrorMessage(e), { timeout: 3000 })
      }
    })
  }

  if (pages.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {pages.map((page) => (
        <div
          key={page.id}
          className="relative flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300"
        >
          {/* its ::after covers the card, which the menu sits above */}
          <Link
            href={routing.entityEdit('page', page.id)}
            className="min-w-0 flex-1 wrap-anywhere font-medium text-link after:absolute after:inset-0 after:rounded-lg"
          >
            {page.name}
          </Link>
          <div className="relative z-10">
            <Menu
              items={[
                {
                  label: 'Duplicate',
                  onSelect: () => router.push(`${routing.entityAdd('page')}?from=${page.id}`),
                },
                { label: 'Delete…', danger: true, onSelect: () => remove(page) },
              ]}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
