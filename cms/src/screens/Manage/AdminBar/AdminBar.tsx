import type { FC } from 'react'
import { Link } from '#cms/framework/link.tsx'
import { User } from '#cms/components/icons.tsx'
import { logout } from '../actions.ts'
import { Breadcrumbs } from '../BreadCrumbs/Breadcrumbs.tsx'
import { routing } from '../routing.ts'

// Main, and at the other end the user and Logout, on a line, and the page's
// breadcrumbs on one of their own under it
export const AdminBar: FC<{ user?: { id: string; name: string } }> = ({ user }) => {
  return (
    <div className="min-h-8 px-4 py-3 flex flex-row flex-wrap items-center gap-2 bg-gray-100">
      <Link href="/" className="interactive text-sm font-bold">
        Main
      </Link>
      {user ? (
        <div className="ml-auto flex flex-row items-center gap-3 text-sm">
          <Link href={routing.me} className="interactive flex items-center gap-0.5 font-normal">
            <User size={16} strokeWidth={2} aria-hidden="true" />
            {user.name}
          </Link>
          <form action={logout} className="flex">
            <button className="interactive font-light">Logout</button>
          </form>
        </div>
      ) : null}
      <Breadcrumbs className="basis-full" />
    </div>
  )
}
