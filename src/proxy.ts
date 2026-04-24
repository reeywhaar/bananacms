import { createCMSMiddleware } from './cmsProxy'

export const proxy = createCMSMiddleware()

// Must be a statically-analyzable literal for Next.js to pick up the matcher.
export const config = {
  // Excludes Next.js internals, the CMS static prefix, and files with extensions.
  matcher: '/((?!_next|cms-static|.*\\..*).*)',
}
