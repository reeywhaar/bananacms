'use client'

import { useApiDispatcher } from '@cms/components/ApiDispatcherProvider/ApiDispatcherProvider'
import { useEvent } from '@cms/hooks/useEvent'
import { useSetError } from '@cms/hooks/useSetError'
import { deleteAuth } from '@cms/lib/api/auth'
import { RequestError } from '@cms/lib/api/Dispatcher'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FC } from 'react'
import { Breadcrumbs } from '../BreadCrumbs/Breadcrumbs'
import { routing } from '../routing'

export const AdminBar: FC<{ user?: { id: string; name: string } }> = ({ user }) => {
  const dispatcher = useApiDispatcher()
  const setError = useSetError()
  const router = useRouter()

  const handleLogout = useEvent(async () => {
    try {
      await dispatcher.dispatch(deleteAuth())
    } catch (e) {
      if (!(e instanceof RequestError)) {
        setError(e)
        return
      }
    }
    router.refresh()
  })

  return (
    <div className="min-h-8 px-4 py-1 flex flex-row items-start justify-between gap-2">
      <Breadcrumbs />
      {user ? (
        <div className="flex flex-row items-center gap-3 text-sm">
          <Link href={routing.me} className="interactive font-light">
            {user.name}
          </Link>
          <button className="interactive font-light" onClick={handleLogout}>
            Logout
          </button>
        </div>
      ) : null}
    </div>
  )
}
