import type {
  Client,
  InArgs,
  InStatement,
  ResultSet,
  Transaction,
  TransactionMode,
} from '@libsql/client'
import type { Logger } from '../logger/Logger.ts'

const SLOW_QUERY_MS = 100
const MAX_SQL_LENGTH = 500

const sqlOf = (stmt: InStatement | [string, InArgs?] | string): string => {
  if (typeof stmt === 'string') return stmt
  if (Array.isArray(stmt)) return stmt[0]
  return stmt.sql
}

const truncateSql = (sql: string): string =>
  sql.length > MAX_SQL_LENGTH ? `${sql.slice(0, MAX_SQL_LENGTH)}…` : sql

// Logs the SQL and its timing, and leaves the query's parameters out: they carry
// auth tokens and password hashes.
const report = (
  logger: Logger,
  sql: string,
  startedAt: number,
  args: Record<string, unknown>,
): void => {
  const durationMs = Math.round((performance.now() - startedAt) * 10) / 10
  const log = logger.child('DB')
  const payload = { sql: truncateSql(sql), durationMs, ...args }
  if ('error' in args) log.warn('query.failed', payload)
  else if (durationMs >= SLOW_QUERY_MS) log.warn('query.slow', payload)
  else log.debug('query', payload)
}

const timed = async <T>(
  logger: Logger,
  sql: string,
  run: () => Promise<T>,
  resultArgs: (result: T) => Record<string, unknown>,
): Promise<T> => {
  const startedAt = performance.now()
  try {
    const result = await run()
    report(logger, sql, startedAt, resultArgs(result))
    return result
  } catch (error) {
    report(logger, sql, startedAt, {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

// Wraps execute/batch on both `Client` and the `Transaction` handles it vends:
// drizzle's libsql session runs plain queries through `client.execute`,
// `db.batch` through `client.batch`, and `db.transaction` through
// `client.transaction()` followed by `tx.execute` per statement.
function wrapWithQueryLog<T extends Client | Transaction>(instance: T, logger: Logger): T {
  return new Proxy(instance, {
    get(target, prop) {
      if (prop === 'execute') {
        return (stmt: InStatement | string, args?: InArgs) =>
          timed(
            logger,
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
            logger,
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
          return wrapWithQueryLog(tx, logger)
        }
      }
      const value = Reflect.get(target, prop) as unknown
      // bound to the target: libsql's internals need the real instance as `this`
      if (typeof value === 'function') return value.bind(target)
      return value
    },
  })
}

// The client, logging each query under `logger`, labeled [DB].
export const wrapClientWithQueryLog = (client: Client, logger: Logger): Client =>
  wrapWithQueryLog(client, logger)
