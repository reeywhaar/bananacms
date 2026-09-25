import { createHash } from 'node:crypto'
import type { Client, Row, Transaction } from '@libsql/client'

/**
 * Produces a deterministic plain-SQL dump of the database: same content in,
 * byte-identical text out, regardless of rowid numbering or VACUUM history.
 * One INSERT per line so snapshots can be stored as line diffs of consecutive
 * dumps. The script is self-contained and restorable via
 * `client.executeMultiple(dump)` on an empty database.
 *
 * Note: integers are read with libsql's default `intMode: 'number'`, so values
 * beyond 2^53 would lose precision. No such columns exist today.
 */
export async function dumpDatabase(client: Client): Promise<string> {
  // A read transaction is the consistency guarantee: every table is dumped
  // from the same database state even while writes happen concurrently.
  const tx = await client.transaction('read')
  try {
    return await dumpWithin(tx)
  } finally {
    tx.close()
  }
}

export const hashDump = (dump: string): string =>
  createHash('sha256').update(dump, 'utf8').digest('hex')

interface MasterEntry {
  type: string
  name: string
  sql: string
}

async function dumpWithin(tx: Transaction): Promise<string> {
  const master = await tx.execute(
    "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
  const entries: MasterEntry[] = master.rows.map((row) => ({
    type: String(row.type),
    name: String(row.name),
    sql: String(row.sql),
  }))

  const tables = entries.filter((e) => e.type === 'table')
  // FTS5 shadow tables (post_fts_data, post_fts_idx, ...) are rebuilt by the
  // virtual table on INSERT; dumping them would corrupt the restored index.
  const virtualNames = tables
    .filter((e) => /^\s*CREATE\s+VIRTUAL\s+TABLE/i.test(e.sql))
    .map((e) => e.name)
  const isShadow = (name: string) => virtualNames.some((v) => name.startsWith(`${v}_`))
  const dataTables = tables.filter((t) => !isShadow(t.name))

  const lines: string[] = ['PRAGMA foreign_keys=OFF;', 'BEGIN;']
  for (const table of dataTables) {
    lines.push(`${table.sql};`)
    await dumpRows(tx, table.name, lines)
  }
  for (const entry of entries) {
    if (entry.type === 'index' || entry.type === 'trigger' || entry.type === 'view') {
      lines.push(`${entry.sql};`)
    }
  }
  lines.push('COMMIT;', '')
  return lines.join('\n')
}

async function dumpRows(tx: Transaction, table: string, lines: string[]): Promise<void> {
  const info = await tx.execute(`PRAGMA table_info(${quoteIdent(table)})`)
  const columns = info.rows.map((row) => ({ name: String(row.name), pk: Number(row.pk) }))
  const pkColumns = columns
    .filter((c) => c.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((c) => c.name)
  // Without a declared PK, order by every column: rowid order is not stable
  // across VACUUM, and determinism is what makes consecutive dumps diffable.
  const orderColumns = pkColumns.length > 0 ? pkColumns : columns.map((c) => c.name)

  const columnList = columns.map((c) => quoteIdent(c.name)).join(', ')
  const result = await tx.execute(
    `SELECT ${columnList} FROM ${quoteIdent(table)} ORDER BY ${orderColumns
      .map(quoteIdent)
      .join(', ')}`,
  )
  for (const row of result.rows) {
    const values = renderRow(row, columns.length)
    lines.push(`INSERT INTO ${quoteIdent(table)} (${columnList}) VALUES (${values});`)
  }
}

const renderRow = (row: Row, columnCount: number): string => {
  const rendered: string[] = []
  for (let i = 0; i < columnCount; i++) {
    rendered.push(renderValue(row[i]))
  }
  return rendered.join(', ')
}

const renderValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number') return renderNumber(value)
  if (typeof value === 'string') return renderText(value)
  if (value instanceof ArrayBuffer) return renderBlob(Buffer.from(value))
  if (value instanceof Uint8Array) return renderBlob(Buffer.from(value))
  throw new Error(`Cannot dump value of type ${typeof value}`)
}

const renderNumber = (value: number): string => {
  if (Number.isNaN(value)) return 'NULL'
  // SQLite has no Infinity literal, but parses out-of-range numerics as Inf.
  if (value === Infinity) return '9e999'
  if (value === -Infinity) return '-9e999'
  return String(value)
}

const renderText = (value: string): string => {
  // Control characters (newlines above all) would break the one-row-per-line
  // format; hex is unambiguous where escape schemes are not.

  if (/[\x00-\x1f]/.test(value)) {
    return `CAST(X'${Buffer.from(value, 'utf8').toString('hex')}' AS TEXT)`
  }
  return `'${value.replaceAll("'", "''")}'`
}

const renderBlob = (value: Buffer): string => `X'${value.toString('hex')}'`

const quoteIdent = (name: string): string => `"${name.replaceAll('"', '""')}"`
