import type { MiddlewareConfig, NextProxy } from 'next/server'
import { getCMS, isCMSInitialized } from './config'
import { combineProxies } from './proxies/combine'
import { createAuthProxy } from './proxies/manageAuth'
import { logging } from './proxies/logging'

// The CMS zone runs as its own child process and doesn't necessarily call
// createCMS() itself — the consumer's cms.ts is loaded by the consumer zone.
// Fall back to the default admin path so the middleware can still function
// as a standalone Next app.
const DEFAULT_ADMIN_PATH = '/manage'

const resolveAdminPath = (): string =>
  isCMSInitialized() ? getCMS().paths.admin : DEFAULT_ADMIN_PATH

export function createCMSMiddleware(): NextProxy {
  let cached: NextProxy | null = null
  const resolve = (): NextProxy => {
    if (cached) return cached
    const adminPath = resolveAdminPath()
    cached = combineProxies(
      logging,
      createAuthProxy({
        protected: [adminPath],
        loginPath: `${adminPath}/login`,
      }),
    )
    return cached
  }
  return (req, evt) => resolve()(req, evt)
}

export const cmsMiddlewareConfig: MiddlewareConfig = {
  // Excludes Next.js internals, CMS static prefix, and files with extensions.
  matcher: '/((?!_next|cms-static|.*\\..*).*)',
}

export const consumerMiddlewareConfig: MiddlewareConfig = {
  // Demo matcher: excludes CMS-handled paths (they're rewritten to the CMS zone), Next internals, and static files.
  matcher: '/((?!manage|api|d/|cms-static|_next|.*\\..*).*)',
}
