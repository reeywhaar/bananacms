const REDIRECT = Symbol.for('cms.redirect')

export type RedirectTarget = { url: string; status: 307 | 308 }

// Like Next's redirect(): call it from middleware, from a page's own body or from
// a server action, to send the browser to `url` instead (see docs/routing.md).
export function redirect(url: string): never {
  throw Object.assign(new Error(`Redirect to ${url}`), { [REDIRECT]: { url, status: 307 } })
}

// redirect() with a 308, which browsers and search engines remember
export function permanentRedirect(url: string): never {
  throw Object.assign(new Error(`Redirect to ${url}`), { [REDIRECT]: { url, status: 308 } })
}

export function redirectTarget(error: unknown): RedirectTarget | undefined {
  return typeof error === 'object' && error !== null && REDIRECT in error
    ? (error as { [REDIRECT]: RedirectTarget })[REDIRECT]
    : undefined
}
