import { createClient, type Client } from '@libsql/client'
import { afterEach, describe, expect, it } from 'vitest'
import { captureLogger } from '#cms/test/logger.ts'
import { wrapClientWithQueryLog } from './queryLog.ts'

const clients: Client[] = []

afterEach(() => {
  for (const client of clients.splice(0)) client.close()
})

// counts to 3 million: some 300ms
const SLOW_SQL =
  'WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < 3000000) SELECT count(*) FROM n'

// work of the event loop's that isn't the query's
const busy = (ms: number) => {
  const until = performance.now() + ms
  while (performance.now() < until);
}

function setup() {
  const { logger, entries } = captureLogger()
  const client = createClient({ url: ':memory:' })
  clients.push(client)
  const wrapped = wrapClientWithQueryLog(client, logger)
  return { wrapped, entries }
}

describe('wrapClientWithQueryLog', () => {
  it('logs execute with sql, timing and row counts at debug, under the root logger', async () => {
    const { wrapped, entries } = setup()

    await wrapped.execute('SELECT 1 AS one')

    expect(entries).toHaveLength(1)
    const entry = entries[0]
    expect(entry.level).toBe('debug')
    expect(entry.message).toBe('query')
    expect(entry.labels).toEqual(['DB'])
    expect(entry.args.sql).toBe('SELECT 1 AS one')
    expect(entry.args.durationMs).toBeTypeOf('number')
    expect(entry.args.rows).toBe(1)
  })

  it('logs batch with statement count', async () => {
    const { wrapped, entries } = setup()

    await wrapped.batch(['SELECT 1', 'SELECT 2'])

    expect(entries).toHaveLength(1)
    expect(entries[0].args.sql).toBe('SELECT 1; SELECT 2')
    expect(entries[0].args.statements).toBe(2)
    expect(entries[0].args.rows).toBe(2)
  })

  it('logs queries executed on an interactive transaction', async () => {
    const { wrapped, entries } = setup()

    const tx = await wrapped.transaction('write')
    try {
      await tx.execute('CREATE TABLE t (id INTEGER PRIMARY KEY)')
      await tx.execute('INSERT INTO t (id) VALUES (1)')
      await tx.commit()
    } finally {
      tx.close()
    }

    const sqls = entries.map((entry) => entry.args.sql)
    expect(sqls).toContain('CREATE TABLE t (id INTEGER PRIMARY KEY)')
    expect(sqls).toContain('INSERT INTO t (id) VALUES (1)')
    expect(
      entries.find((e) => e.args.sql === 'INSERT INTO t (id) VALUES (1)')?.args.rowsAffected,
    ).toBe(1)
  })

  it("leaves out of a query's time what the event loop runs before its result", async () => {
    const { wrapped, entries } = setup()

    const execute = wrapped.execute('SELECT 1')
    busy(150)
    await execute
    const batch = wrapped.batch(['SELECT 1'])
    busy(150)
    await batch
    {
      using stack = new DisposableStack()
      const tx = stack.adopt(await wrapped.transaction('read'), (tx) => tx.close())
      const txExecute = tx.execute('SELECT 1')
      busy(150)
      await txExecute
    }

    expect(entries.map((entry) => entry.message)).toEqual(['query', 'query', 'query'])
  })

  // and so a libsql that runs the query elsewhere than the timing expects fails here,
  // rather than leaves slow queries out of the log
  it('logs a slow query as slow, from the client and from a transaction', async () => {
    const { wrapped, entries } = setup()

    await wrapped.execute(SLOW_SQL)
    await wrapped.batch([SLOW_SQL])
    {
      using stack = new DisposableStack()
      const tx = stack.adopt(await wrapped.transaction('read'), (tx) => tx.close())
      await tx.execute(SLOW_SQL)
    }

    expect(entries.map((entry) => entry.message)).toEqual([
      'query.slow',
      'query.slow',
      'query.slow',
    ])
  })

  it('logs failed queries at warn with the error message and rethrows', async () => {
    const { wrapped, entries } = setup()

    await expect(wrapped.execute('SELECT nope FROM missing')).rejects.toThrow()

    expect(entries).toHaveLength(1)
    expect(entries[0].level).toBe('warn')
    expect(entries[0].message).toBe('query.failed')
    expect(entries[0].args.error).toBeTruthy()
  })
})
