import { createCMSMiddleware } from './cmsProxy'

export const proxy = createCMSMiddleware()

// Must be a statically-analyzable literal for Next.js to pick up the matcher.
export const config = {
  matcher: '/((?!_next|cms-static|.*\\..*).*)',
}
