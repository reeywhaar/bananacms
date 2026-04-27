import { createClient, type Client, type ResultSet } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql/node'
import { type BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { schema, type Schema } from './schema'

/**
 * Wide type accepted by all stores. Both `LibSQLDatabase<Schema>` (top-level db)
 * and `SQLiteTransaction<...>` (inside `db.transaction(async (tx) => ...)`)
 * extend this — so stores can be constructed with either.
 */
export type Db = BaseSQLiteDatabase<'async', ResultSet, Schema>

export function openDb(filename: string): { client: Client; db: Db } {
  const url = filename === ':memory:' ? ':memory:' : `file:${filename}`
  const client = createClient({ url })
  const db = drizzle(client, { schema })
  return { client, db }
}

const MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS migrations (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    up   TEXT,
    down TEXT
  )
`

const MIGRATION_FILE_RE = /^(\d+)_(.+)\.sql$/

type Migration = {
  id: number
  name: string
  up: string
  down: string
}

export async function runMigrations(
  client: Client,
  migrationsPath: string,
  opts: { force?: boolean } = {},
): Promise<void> {
  const migrations = loadMigrations(migrationsPath)

  await client.execute(MIGRATIONS_TABLE)

  const appliedRows = await client.execute('SELECT id, name FROM migrations')
  const applied = new Map<string, number>()
  for (const row of appliedRows.rows) {
    applied.set(String(row.name), Number(row.id))
  }

  if (opts.force) {
    for (let i = migrations.length - 1; i >= 0; i--) {
      const m = migrations[i]
      if (!applied.has(m.name)) continue
      await applyDown(client, m)
    }
    await client.execute('DELETE FROM migrations')
    applied.clear()
  }

  for (const m of migrations) {
    if (applied.has(m.name)) continue
    await applyUp(client, m)
  }
}

function loadMigrations(migrationsPath: string): Migration[] {
  const files = readdirSync(migrationsPath).filter((f) => MIGRATION_FILE_RE.test(f))
  const migrations: Migration[] = []
  for (const file of files) {
    const match = MIGRATION_FILE_RE.exec(file)
    if (!match) continue
    const id = Number(match[1])
    const name = match[2]
    const raw = readFileSync(join(migrationsPath, file), 'utf-8')
    const { up, down } = parseUpDown(raw)
    migrations.push({ id, name, up, down })
  }
  migrations.sort((a, b) => a.id - b.id)
  return migrations
}

function parseUpDown(raw: string): { up: string; down: string } {
  const upMatch = raw.match(/--\s*Up\b([\s\S]*?)(?=--\s*Down\b|$)/i)
  const downMatch = raw.match(/--\s*Down\b([\s\S]*)$/i)
  return {
    up: upMatch ? upMatch[1].trim() : raw.trim(),
    down: downMatch ? downMatch[1].trim() : '',
  }
}

async function fkOn(client: Client): Promise<boolean> {
  const r = await client.execute('PRAGMA foreign_keys')
  return Number(r.rows[0]?.foreign_keys ?? 0) === 1
}

async function applyUp(client: Client, m: Migration): Promise<void> {
  const togglesFk = /PRAGMA\s+foreign_keys\s*=\s*OFF/i.test(m.up)
  const fkBefore = await fkOn(client)
  if (togglesFk && fkBefore) await client.execute('PRAGMA foreign_keys = OFF')

  const escapedName = m.name.replace(/'/g, "''")
  const insertSql = `INSERT INTO migrations (id, name, up, down) VALUES (${m.id}, '${escapedName}', '', '')`

  try {
    await client.executeMultiple(`BEGIN IMMEDIATE;\n${m.up};\n${insertSql};\nCOMMIT;`)
  } catch (e) {
    try {
      await client.execute('ROLLBACK')
    } catch {
      /* not in tx */
    }
    throw e
  } finally {
    if (togglesFk && fkBefore) await client.execute('PRAGMA foreign_keys = ON')
  }
}

async function applyDown(client: Client, m: Migration): Promise<void> {
  if (!m.down) {
    await client.execute({ sql: 'DELETE FROM migrations WHERE name = ?', args: [m.name] })
    return
  }
  const togglesFk = /PRAGMA\s+foreign_keys\s*=\s*OFF/i.test(m.down)
  const fkBefore = await fkOn(client)
  if (togglesFk && fkBefore) await client.execute('PRAGMA foreign_keys = OFF')

  const escapedName = m.name.replace(/'/g, "''")
  const deleteSql = `DELETE FROM migrations WHERE name = '${escapedName}'`

  try {
    await client.executeMultiple(`BEGIN IMMEDIATE;\n${m.down};\n${deleteSql};\nCOMMIT;`)
  } catch (e) {
    try {
      await client.execute('ROLLBACK')
    } catch {
      /* not in tx */
    }
    throw e
  } finally {
    if (togglesFk && fkBefore) await client.execute('PRAGMA foreign_keys = ON')
  }
}
