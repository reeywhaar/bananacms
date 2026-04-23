import { NextRequest, NextResponse } from 'next/server'
import { getServices } from '@cms/services/getServices'
import { ApiError } from './api/error'

type RouteHandler<C = unknown> = (request: NextRequest, context: C) => Promise<Response>

export function createRouteHandler<C = unknown>(handler: RouteHandler<C>): RouteHandler<C> {
  return async (request, context) => {
    const { rootLogger } = await getServices()
    const startedAt = Date.now()
    const method = request.method
    const path = new URL(request.url).pathname
    const log = rootLogger.child('RouteHandler', { method, path })
    log.info('start')
    try {
      const response = await handler(request, context)
      log.info('end', {
        status: response.status,
        durationMs: Date.now() - startedAt,
      })
      return response
    } catch (error) {
      const message =
        error instanceof ApiError && error.exposed ? error.message : 'Internal Server Error'
      const status = error instanceof ApiError ? error.status : 500
      log.error('failed', {
        status,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: message }, { status })
    }
  }
}
