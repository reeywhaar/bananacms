import { createClient, type Client, type ResultSet } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql/node'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { cmsMigrations } from '../migrations/index.ts'
import {
  MigrationHandler,
  parseMigrationFileName,
  type Migration,
  type MigrationEntry,
} from '../migrations/migration.ts'
import { schema, type Schema } from './schema.ts'
import { derivedSchema, type DerivedSchema } from './derivedSchema.ts'

/**
 * Wide type accepted by all stores. Both `LibSQLDatabase<Schema>` (top-level db)
 * and `SQLiteTransaction<...>` (inside `db.transaction(async (tx) => ...)`)
 * extend this — so stores can be constructed with either.
 */
export type Db = BaseSQLiteDatabase<'async', ResultSet, Schema>

export type DerivedDb = BaseSQLiteDatabase<'async', ResultSet, DerivedSchema>

export async function openClient(filename: string): Promise<Client> {
  const url = filename === ':memory:' ? ':memory:' : `file:${filename}`
  const client = createClient({ url })
  await applyConnectionPragmas(client)
  return client
}

// drizzle handles on a client, which can be one wrapped for query logs (queryLog.ts)
export const createDb = (client: Client): Db => drizzle(client, { schema })

export const createDerivedDb = (client: Client): DerivedDb =>
  drizzle(client, { schema: derivedSchema })

export async function openDb(filename: string): Promise<{ client: Client; db: Db }> {
  const client = await openClient(filename)
  return { client, db: createDb(client) }
}

export async function openDerivedDb(filename: string): Promise<{ client: Client; db: DerivedDb }> {
  const client = await openClient(filename)
  return { client, db: createDerivedDb(client) }
}

const MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS migrations (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
  )
`

// The CMS's migrations and the site's, in the order they run. Of migrations that
// share a name, only the lowest id runs.
export function migrationEntries(siteMigrations: MigrationEntry[] = []): MigrationEntry[] {
  const seen = new Set<string>()
  return [...cmsMigrations, ...siteMigrations]
    .sort((a, b) => a.id - b.id)
    .filter(({ name }) => (seen.has(name) ? false : seen.add(name) && true))
}

// Runs the CMS's migrations and the site's `siteMigrations` that the migrations
// table doesn't record yet, in id order (docs/migrations.md).
export async function runMigrations(
  client: Client,
  derivedClient: Client,
  opts: { force?: boolean; siteMigrations?: MigrationEntry[] } = {},
): Promise<void> {
  const entries = migrationEntries(opts.siteMigrations)

  await client.execute(MIGRATIONS_TABLE)
  await normalizeLegacyMigrationsTable(client)

  const appliedRows = await client.execute('SELECT id, name FROM migrations')
  const applied = new Set<number>()
  for (const row of appliedRows.rows) {
    applied.add(Number(row.id))
  }

  if (opts.force) {
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i]
      if (!applied.has(entry.id)) continue
      await new MigrationHandler(entry).runDown(client, derivedClient)
    }
    applied.clear()
  }

  for (const entry of entries) {
    if (applied.has(entry.id)) continue
    await new MigrationHandler(entry).runUp(client, derivedClient)
  }
}

/**
 * Databases created before the bookkeeping-only migrations table stored the
 * migration SQL in NOT NULL `up`/`down` columns. `CREATE TABLE IF NOT EXISTS`
 * silently keeps that legacy shape, and the first new migration then fails
 * its `INSERT INTO migrations (id, name)` with a NOT NULL violation on `up`.
 * Rebuild the table into the current (id, name) format, keeping the rows.
 */
async function normalizeLegacyMigrationsTable(client: Client): Promise<void> {
  const info = await client.execute('PRAGMA table_info(migrations)')
  const columns = new Set(info.rows.map((row) => String(row.name)))
  if (!columns.has('up') && !columns.has('down')) return

  await client.executeMultiple(`
    BEGIN;
    CREATE TABLE migrations_normalized (
      id   INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );
    INSERT INTO migrations_normalized (id, name) SELECT id, name FROM migrations;
    DROP TABLE migrations;
    ALTER TABLE migrations_normalized RENAME TO migrations;
    COMMIT;
  `)
}

/**
 * libsql opens local files with journal_mode=delete, synchronous=FULL and
 * busy_timeout=0: every write takes an exclusive lock that blocks all reads,
 * and concurrent access fails instantly with SQLITE_BUSY instead of queueing.
 * WAL keeps readers unblocked while a write transaction is open; NORMAL is
 * the recommended synchronous level under WAL. On :memory: databases the WAL
 * pragma is a no-op.
 */
async function applyConnectionPragmas(client: Client): Promise<void> {
  await client.executeMultiple(`
    PRAGMA journal_mode=WAL;
    PRAGMA synchronous=NORMAL;
    PRAGMA busy_timeout=5000;
  `)
}

// Reads <id>_<name>.ts migration files from a directory at runtime, for running
// a site's migrations outside Vite, where import.meta.glob isn't available.
export async function loadMigrations(migrationsPath: string): Promise<MigrationEntry[]> {
  const files = existsSync(migrationsPath)
    ? readdirSync(migrationsPath).filter((f) => /\.[jt]s$/.test(f) && !f.endsWith('.d.ts'))
    : []

  const entries: MigrationEntry[] = []
  for (const file of files) {
    const filePath = join(migrationsPath, file)
    const { id, name } = parseMigrationFileName(filePath)
    const mod = await import(/* @vite-ignore */ pathToFileURL(filePath).href)
    const migration: Migration = mod.default
    entries.push({ id, name, migration })
  }
  entries.sort((a, b) => a.id - b.id)
  return entries
}
