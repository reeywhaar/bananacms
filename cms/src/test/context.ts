import { Context, createRequestContext, setDatabases } from '../framework/context.ts'
import type { TestDb } from './db.ts'
import { captureLogger } from './logger.ts'

// A request's ctx, as the CMS's middleware leaves it when `testDb` is given, with
// a logger that keeps its entries.
export function createTestContext(
  options: { url?: string; method?: string; cookie?: string; testDb?: TestDb; rsc?: boolean } = {},
) {
  const url = new URL(options.url ?? 'http://site.test/')
  const request = new Request(url, {
    method: options.method,
    headers: options.cookie ? { cookie: options.cookie } : {},
  })
  const { logger, entries } = captureLogger()
  const ctx = createRequestContext(new Context(), {
    request,
    url,
    params: {},
    logger: logger.child('Request'),
    rsc: options.rsc ?? false,
  })
  if (options.testDb) setDatabases(ctx, options.testDb)
  return { ctx, entries }
}
