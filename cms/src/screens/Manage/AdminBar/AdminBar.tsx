import type { FC } from 'react'
import { Link } from '../../../framework/link.tsx'
import { logout } from '../actions.ts'
import { Breadcrumbs } from '../BreadCrumbs/Breadcrumbs.tsx'
import { routing } from '../routing.ts'

export const AdminBar: FC<{ user?: { id: string; name: string } }> = ({ user }) => {
  return (
    <div className="min-h-8 px-4 py-1 flex flex-row items-start justify-between gap-2">
      <Breadcrumbs />
      {user ? (
        <div className="flex flex-row items-center gap-3 text-sm">
          <Link href={routing.me} className="interactive font-light">
            {user.name}
          </Link>
          <form action={logout} className="flex">
            <button className="interactive font-light">Logout</button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
