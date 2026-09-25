import type { ComponentProps } from 'react'

// Like Next's <Link>: an <a>, which the browser entry turns into client-side
// navigation within the app the page is in. It works in server and client
// components alike.
export function Link(props: ComponentProps<'a'> & { href: string }) {
  return <a {...props} />
}
