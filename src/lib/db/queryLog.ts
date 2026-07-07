import type {
  Client,
  InArgs,
  InStatement,
  ResultSet,
  Transaction,
  TransactionMode,
} from '@libsql/client'
import { createRootLogger } from '../logger/root'
import type { Logger } from '../logger/Logger'

const SLOW_QUERY_MS = 100
const MAX_SQL_LENGTH = 500

/**
 * Resolved lazily per query so request-scoped context (traceId, sessionId)
 * attaches to query logs. May return undefined or throw outside a request
 * scope (startup, CLI) — the wrapper then falls back to a root logger.
 */
export type QueryLoggerSource = () => Promise<Logger | undefined>

let fallbackRoot: Logger | undefined

const resolveLogger = async (source: QueryLoggerSource): Promise<Logger> => {
  try {
    const logger = await source()
    if (logger) return logger
  } catch {
    // Outside a request scope — fall through to the root logger.
  }
  return (fallbackRoot ??= createRootLogger())
}

const sqlOf = (stmt: InStatement | [string, InArgs?] | string): string => {
  if (typeof stmt === 'string') return stmt
  if (Array.isArray(stmt)) return stmt[0]
  return stmt.sql
}

const truncateSql = (sql: string): string =>
  sql.length > MAX_SQL_LENGTH ? `${sql.slice(0, MAX_SQL_LENGTH)}…` : sql

// Query params are deliberately not logged: they carry auth tokens and
// password hashes.
const report = async (
  source: QueryLoggerSource,
  sql: string,
  startedAt: number,
  args: Record<string, unknown>,
): Promise<void> => {
  const durationMs = Math.round((performance.now() - startedAt) * 10) / 10
  const log = (await resolveLogger(source)).child('DB')
  const payload = { sql: truncateSql(sql), durationMs, ...args }
  if ('error' in args) log.warn('query.failed', payload)
  else if (durationMs >= SLOW_QUERY_MS) log.warn('query.slow', payload)
  else log.debug('query', payload)
}

const timed = async <T>(
  source: QueryLoggerSource,
  sql: string,
  run: () => Promise<T>,
  resultArgs: (result: T) => Record<string, unknown>,
): Promise<T> => {
  const startedAt = performance.now()
  try {
    const result = await run()
    await report(source, sql, startedAt, resultArgs(result))
    return result
  } catch (error) {
    await report(source, sql, startedAt, {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Wraps execute/batch on both `Client` and the `Transaction` handles it
 * vends: drizzle's libsql session runs plain queries via `client.execute`,
 * `db.batch` via `client.batch`, and `db.transaction` via
 * `client.transaction()` followed by `tx.execute` per statement.
 */
function wrapWithQueryLog<T extends Client | Transaction>(
  instance: T,
  source: QueryLoggerSource,
): T {
  return new Proxy(instance, {
    get(target, prop) {
      if (prop === 'execute') {
        return (stmt: InStatement | string, args?: InArgs) =>
          timed(
            source,
            sqlOf(stmt),
            () =>
              (target.execute as (stmt: InStatement | string, args?: InArgs) => Promise<ResultSet>)(
                stmt,
                args,
              ),
            (result) => ({ rows: result.rows.length, rowsAffected: result.rowsAffected }),
          )
      }
      if (prop === 'batch') {
        return (stmts: Array<InStatement | [string, InArgs?]>, mode?: TransactionMode) =>
          timed(
            source,
            stmts.map(sqlOf).join('; '),
            () => (target as Client).batch(stmts, mode),
            (results) => ({
              statements: stmts.length,
              rows: results.reduce((n, r) => n + r.rows.length, 0),
            }),
          )
      }
      if (prop === 'transaction' && 'transaction' in target) {
        return async (mode?: TransactionMode) => {
          const client = target as Client
          const tx =
            mode === undefined ? await client.transaction() : await client.transaction(mode)
          return wrapWithQueryLog(tx, source)
        }
      }
      const value = Reflect.get(target, prop) as unknown
      // Bind to the target, not the proxy: libsql internals must see the
      // real instance as `this`.
      if (typeof value === 'function') return value.bind(target)
      return value
    },
  })
}

export const wrapClientWithQueryLog = (client: Client, source: QueryLoggerSource): Client =>
  wrapWithQueryLog(client, source)
