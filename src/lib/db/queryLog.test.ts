import { createClient, type Client } from '@libsql/client'
import { afterEach, describe, expect, it } from 'vitest'
import { Logger, LoggerContext, type Formatter, type LogEntry, type Sink } from '../logger/Logger'
import { wrapClientWithQueryLog } from './queryLog'

const clients: Client[] = []

afterEach(() => {
  for (const client of clients.splice(0)) client.close()
})

function setup(source?: () => Promise<Logger | undefined>) {
  const entries: LogEntry[] = []
  const formatter: Formatter = {
    format: (entry) => {
      entries.push(entry)
      return ''
    },
  }
  const sink: Sink = { write: () => {} }
  const logger = new Logger('Test', new LoggerContext({}), formatter, sink, 'debug')
  const client = createClient({ url: ':memory:' })
  clients.push(client)
  const wrapped = wrapClientWithQueryLog(client, source ?? (async () => logger))
  return { wrapped, entries }
}

describe('wrapClientWithQueryLog', () => {
  it('logs execute with sql, timing and row counts at debug', async () => {
    const { wrapped, entries } = setup()

    await wrapped.execute('SELECT 1 AS one')

    expect(entries).toHaveLength(1)
    const entry = entries[0]
    expect(entry.level).toBe('debug')
    expect(entry.message).toBe('query')
    expect(entry.service).toBe('DB')
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

  it('logs failed queries at warn with the error message and rethrows', async () => {
    const { wrapped, entries } = setup()

    await expect(wrapped.execute('SELECT nope FROM missing')).rejects.toThrow()

    expect(entries).toHaveLength(1)
    expect(entries[0].level).toBe('warn')
    expect(entries[0].message).toBe('query.failed')
    expect(entries[0].args.error).toBeTruthy()
  })

  it('still executes queries when the logger source throws (outside request scope)', async () => {
    const { wrapped } = setup(async () => {
      throw new Error('headers() called outside a request scope')
    })

    const result = await wrapped.execute('SELECT 1 AS one')
    expect(result.rows).toHaveLength(1)
  })
})
