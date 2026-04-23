import { createClient, type Client, type ResultSet } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql/node'
import { type BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import { existsSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MigrationHandler, type Migration, type MigrationEntry } from '../migrations/migration'
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
    name TEXT NOT NULL UNIQUE
  )
`

const MIGRATION_FILE_RE = /^(\d+)_(.+)\.(ts|js)$/

// Build the migrations path at runtime via path.resolve so bundlers don't
// statically analyze it as an asset module reference.
const CMS_MIGRATIONS_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')

export async function runMigrations(client: Client, opts: { force?: boolean } = {}): Promise<void> {
  const clientMigrationsPath = join(process.cwd(), 'src', 'lib', 'migrations')
  const [cmsEntries, clientEntries] = await Promise.all([
    loadMigrations(CMS_MIGRATIONS_PATH),
    loadMigrations(clientMigrationsPath),
  ])

  // Merge and sort by id; deduplicate by name (CMS takes precedence).
  const seen = new Set<string>()
  const entries = [...cmsEntries, ...clientEntries]
    .sort((a, b) => a.id - b.id)
    .filter(({ name }) => (seen.has(name) ? false : seen.add(name) && true))

  await client.execute(MIGRATIONS_TABLE)

  const appliedRows = await client.execute('SELECT id, name FROM migrations')
  const applied = new Set<number>()
  for (const row of appliedRows.rows) {
    applied.add(Number(row.id))
  }

  if (opts.force) {
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i]
      if (!applied.has(entry.id)) continue
      await new MigrationHandler(entry).runDown(client)
    }
    applied.clear()
  }

  for (const entry of entries) {
    if (applied.has(entry.id)) continue
    await new MigrationHandler(entry).runUp(client)
  }
}

async function loadMigrations(migrationsPath: string): Promise<MigrationEntry[]> {
  const files = existsSync(migrationsPath)
    ? readdirSync(migrationsPath).filter((f) => MIGRATION_FILE_RE.test(f) && !f.endsWith('.d.ts'))
    : []

  const entries: MigrationEntry[] = []
  for (const file of files) {
    const match = MIGRATION_FILE_RE.exec(file)
    if (!match) continue
    const id = Number(match[1])
    const name = match[2]
    const url = pathToFileURL(join(migrationsPath, file)).href
    const mod = await import(
      /* webpackIgnore: true */
      /* turbopackIgnore: true */
      url
    )
    const migration: Migration = mod.default
    entries.push({ id, name, migration })
  }
  entries.sort((a, b) => a.id - b.id)
  return entries
}
