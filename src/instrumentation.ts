import type { Instrumentation } from 'next/types'
import { v4 as uuid } from 'uuid'
import { createRootLogger } from './lib/logger/root'

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (!process.env.BANANACMS_CONFIG_MODULE) return
  // dev.ts guarantees BANANACMS_CONFIG_MODULE is an absolute POSIX path.
  await import(
    /* webpackIgnore: true */
    /* turbopackIgnore: true */
    `file://${process.env.BANANACMS_CONFIG_MODULE}`
  )
}

const readTraceId = (headers: NodeJS.Dict<string | string[]>): string => {
  const value = headers['x-trace-id']
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.length > 0) return value[0]
  return uuid()
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  errorRequest,
  errorContext,
) => {
  const traceId = readTraceId(errorRequest.headers)
  const log = createRootLogger({ traceId })
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined
  log.error('failed', {
    method: errorRequest.method,
    path: errorRequest.path,
    routePath: errorContext.routePath,
    routeType: errorContext.routeType,
    routerKind: errorContext.routerKind,
    error: message,
    stack,
  })
}
