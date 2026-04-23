import { combineProxies } from '@reeywhaar/bananacms/runtime'
import { intlProxy } from '@app/proxies/intl'

export default combineProxies(intlProxy)

// Must be a statically-analyzable literal for Next.js to pick up the matcher.
export const config = {
  // Excludes CMS-handled paths (rewritten to the CMS zone), Next internals, and files with extensions.
  matcher: '/((?!manage|api|d/|cms-static|_next|.*\\..*).*)',
}
