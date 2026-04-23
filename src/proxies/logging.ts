import { getServices } from '@cms/services/getServices'
import type { ProxyMiddleware } from './combine'

export const logging: ProxyMiddleware = async (request, _event, next) => {
  const services = await getServices()
  const log = services.rootLogger.child('Request')
  const method = request.method
  const path = request.nextUrl.pathname
  const startedAt = Date.now()
  log.info('start', { method, path })
  const response = await next()
  log.info('end', { method, path, status: response.status, durationMs: Date.now() - startedAt })
  return response
}
