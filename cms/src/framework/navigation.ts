'use client'

// A client module, as React's server build has no createContext: a server
// component that imports @reeywhaar/bananacms/client, for <Link>, gets references to these.

import { createContext, use, useMemo } from 'react'

// Provided by the SSR and browser roots (entry.ssr.tsx, entry.browser.tsx): the
// current URL's path and query, and whether an RSC re-render (navigation, server
// action, HMR) is in flight.
export const NavigationContext = createContext({ isPending: false, pathname: '/', search: '' })

export type Router = {
  push(href: string): void
  replace(href: string): void
  // renders the current URL again, with fresh data from the server
  refresh(): void
  back(): void
}

// The browser root provides the working router. This default does nothing, as
// on the server, where there's nowhere to navigate.
export const RouterContext = createContext<Router>({
  push() {},
  replace() {},
  refresh() {},
  back() {},
})

export function useNavigationPending(): boolean {
  return use(NavigationContext).isPending
}

// like Next's usePathname()
export function usePathname(): string {
  return use(NavigationContext).pathname
}

// like Next's useSearchParams()
export function useSearchParams(): URLSearchParams {
  const { search } = use(NavigationContext)
  return useMemo(() => new URLSearchParams(search), [search])
}

// Like Next's useRouter(): navigation within the app the page is in (the site, or
// /manage) is client-side, and to anywhere else a full page load.
export function useRouter(): Router {
  return use(RouterContext)
}
