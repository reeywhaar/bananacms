import { getRequestLogger } from '@cms/services/getServices'
import type { ProxyMiddleware } from './combine'

export const logging: ProxyMiddleware = async (request, _event, next) => {
  // getRequestLogger, not getServices: the full services factory performs
  // auth-token + user lookups, which this proxy would pay on every matched
  // request — public pages and asset URLs included.
  const log = (await getRequestLogger()).child('Request')
  const method = request.method
  const path = request.nextUrl.pathname
  const startedAt = Date.now()
  log.debug('start', { method, path })
  const response = await next()
  log.debug('end', { method, path, status: response.status, durationMs: Date.now() - startedAt })
  return response
}
