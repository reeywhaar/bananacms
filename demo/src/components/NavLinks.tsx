'use client'

import { Link, usePathname } from '@reeywhaar/bananacms/client'

// a client component so the active link can come from usePathname(), which keeps
// it right on a post's page too
export function NavLinks(props: { links: { href: string; label: string }[] }) {
  const pathname = usePathname()
  return props.links.map((link) => {
    const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={active ? 'page' : undefined}
        className="text-stone-500 hover:text-stone-900 aria-[current=page]:font-semibold aria-[current=page]:text-stone-900"
      >
        {link.label}
      </Link>
    )
  })
}
