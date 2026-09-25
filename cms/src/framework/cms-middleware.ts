import { assetDelivery } from '../lib/assetDelivery.ts'
import { assetFastPath } from '../lib/assetFastPath.ts'
import { authenticate, manageGate } from '../lib/auth.ts'
import { errorFields } from '../lib/logger/Logger.ts'
import { getLogger, getRequest, isRscRequest, setDatabases } from './context.ts'
import { requestDatabases } from './databases.ts'
import type { Middleware } from './middleware.ts'
import { redirectResponse } from './redirect-response.ts'
import { redirectTarget } from './redirect.ts'

// Logs each request as it starts (debug, with the client's details) and once its
// response is ready (info), and turns an error that reaches it into a 500.
const requestLog: Middleware = async (ctx, next) => {
  const startedAt = performance.now()
  getLogger(ctx).debug('start', clientDetails(getRequest(ctx)))
  try {
    const response = await next()
    getLogger(ctx).info('end', { status: response.status, durationMs: since(startedAt) })
    return response
  } catch (error) {
    getLogger(ctx).error('failed', {
      status: 500,
      durationMs: since(startedAt),
      ...errorFields(error),
    })
    return new Response('Internal Server Error', {
      status: 500,
      headers: { 'content-type': 'text/plain' },
    })
  }
}

// Turns a redirect() from the middleware after it, or from a page or action before
// it starts rendering, into its response (redirect-response.ts).
const redirects: Middleware = async (ctx, next) => {
  try {
    return await next()
  } catch (error) {
    const target = redirectTarget(error)
    if (!target) throw error
    return redirectResponse(ctx, target, isRscRequest(ctx))
  }
}

const databases: Middleware = async (ctx, next) => {
  setDatabases(ctx, await requestDatabases(ctx))
  return next()
}

// The CMS's middleware, in order. Asset requests are answered before the session
// is looked up, and encoded image variants before the databases too. The site's
// middleware runs after it all, so the databases and the session are in ctx by
// then (getDb(), getAuth()).
export const cmsMiddleware: readonly Middleware[] = [
  requestLog,
  assetFastPath,
  redirects,
  databases,
  assetDelivery,
  authenticate,
  manageGate,
]

export function since(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 10) / 10
}

function clientDetails(request: Request): Record<string, string> {
  const headers = request.headers
  const details = {
    host: headers.get('host'),
    ip: headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip'),
    ua: headers.get('user-agent'),
    referer: headers.get('referer'),
  }
  return Object.fromEntries(
    Object.entries(details).filter((entry): entry is [string, string] => Boolean(entry[1])),
  )
}
