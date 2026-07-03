import type { Instrumentation } from 'next/types'
import { v4 as uuid } from 'uuid'
import { createRootLogger } from './lib/logger/root'

export async function register(): Promise<void> {
  // The wrapping `if` (rather than an early return) is deliberate: the
  // bundler inlines NEXT_RUNTIME per compile target and dead-code-eliminates
  // this whole branch — including the dynamic import below — from the Edge
  // Runtime build, where the snapshots module's node:fs/path/crypto imports
  // would otherwise raise unsupported-module warnings.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.BANANACMS_CONFIG_MODULE) {
      // dev.ts guarantees BANANACMS_CONFIG_MODULE is an absolute POSIX path.
      await import(
        /* webpackIgnore: true */
        /* turbopackIgnore: true */
        `file://${process.env.BANANACMS_CONFIG_MODULE}`
      )
    }

    // After the config module so getCMS().env.dbPath is available; falls
    // back to DATA_PATH when there is no config module. A snapshot failure
    // must not block boot.
    try {
      const { runStartupSnapshot } = await import('./lib/snapshots/setup')
      await runStartupSnapshot()
    } catch (error) {
      createRootLogger()
        .child('snapshots')
        .error('startup snapshot failed', {
          error: error instanceof Error ? error.message : String(error),
        })
    }
  }
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
