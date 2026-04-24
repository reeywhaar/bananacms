import { createCMSMiddleware } from './cmsProxy.ts'

export const proxy = createCMSMiddleware()

// Must be a statically-analyzable literal for Next.js to pick up the matcher.
// Shipped as .js (not .ts) so tsup doesn't transpile it — esbuild otherwise
// rewrites `export const config = {...}` to `export { config }`, which Next 16
// rejects as "reexported".
export const config = {
  matcher: '/((?!_next|cms-static|.*\\..*).*)',
}
