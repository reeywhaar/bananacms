import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Client } from '@libsql/client'
import {
  loadMigrations,
  migrationEntries,
  openDb,
  openDerivedDb,
  runMigrations,
} from '../lib/db/client.ts'
import { openSiteDatabases, siteMigrationsPath } from './site-databases.ts'

// Runs the CMS's migrations and the site's that haven't run yet, as the server does
// on its first request, then checks the foreign keys. With `force`, every
// migration's down runs first, newest first, and then every up.
export async function migrate(root: string, options: { force?: boolean } = {}): Promise<void> {
  using databases = await openSiteDatabases(root, { migrate: true, force: options.force })
  const violations = (await databases.main.client.execute('PRAGMA foreign_key_check')).rows
  if (violations.length > 0) {
    throw new Error(
      `Foreign key violations after migrating:\n${violations.map((row) => JSON.stringify(row)).join('\n')}`,
    )
  }
  console.info(`bananacms: migrations done${options.force ? ', from scratch' : ''}`)
}

// Fails unless the site's databases are what its migrations make: every
// migration has run, none has run that the CMS and the site don't have, and
// both databases have the schema a new pair gets from the migrations. It only
// reads them, so it can run while the site does.
export async function checkMigrations(root: string): Promise<void> {
  const siteMigrations = await loadMigrations(siteMigrationsPath(root))
  using databases = await openSiteDatabases(root)
  const differences: string[] = []

  const known = migrationEntries(siteMigrations)
  const recorded = await recordedMigrations(databases.main.client)
  for (const { id, name } of known) {
    if (!recorded.has(id)) differences.push(`migration ${id} ${name} hasn't run`)
  }
  for (const [id, name] of recorded) {
    if (!known.some((entry) => entry.id === id)) {
      differences.push(`migration ${id} ${name} has run, and there's no such migration`)
    }
  }

  const dir = await mkdtemp(path.join(tmpdir(), 'bananacms-migrations-'))
  try {
    const main = await openDb(path.join(dir, 'database.db'))
    const derived = await openDerivedDb(path.join(dir, 'derived.db'))
    try {
      await runMigrations(main.client, derived.client, { siteMigrations })
      differences.push(
        ...schemaDifferences(
          'database.db',
          await schemaOf(databases.main.client),
          await schemaOf(main.client),
        ),
        ...schemaDifferences(
          'derived.db',
          await schemaOf(databases.derived.client),
          await schemaOf(derived.client),
        ),
      )
    } finally {
      main.client.close()
      derived.client.close()
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }

  if (differences.length > 0) {
    for (const difference of differences) console.info(`  ${difference}`)
    throw new Error(
      `The databases aren't what the migrations make: ${differences.length} ${differences.length === 1 ? 'difference' : 'differences'}`,
    )
  }
  console.info(`bananacms: the databases are what the ${known.length} migrations make`)
}

async function recordedMigrations(client: Client): Promise<Map<number, string>> {
  const table = await client.execute(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'migrations'",
  )
  if (table.rows.length === 0) return new Map()
  const { rows } = await client.execute('SELECT id, name FROM migrations ORDER BY id')
  return new Map(rows.map((row) => [Number(row.id), String(row.name)]))
}

// A database's tables, indexes, triggers and views, by `<type> <name>`, with the
// SQL that makes them, its whitespace collapsed. SQLite's own objects are left
// out: their SQL is in the tables'.
async function schemaOf(client: Client): Promise<Map<string, string>> {
  const { rows } = await client.execute(
    "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
  )
  return new Map(
    rows.map((row) => [
      `${String(row.type)} ${String(row.name)}`,
      String(row.sql ?? '')
        .replace(/\s+/g, ' ')
        .trim(),
    ]),
  )
}

function schemaDifferences(
  file: string,
  actual: Map<string, string>,
  expected: Map<string, string>,
): string[] {
  const differences: string[] = []
  for (const [object, sql] of expected) {
    const has = actual.get(object)
    if (has === undefined) differences.push(`${file}: no ${object}, which the migrations make`)
    else if (has !== sql) {
      differences.push(`${file}: ${object} is ${has}, and the migrations make ${sql}`)
    }
  }
  for (const object of actual.keys()) {
    if (!expected.has(object))
      differences.push(`${file}: ${object}, which the migrations don't make`)
  }
  return differences
}

// Creates src/lib/migrations/<Date.now()>_<name>.ts, with an up and a down to fill
// in (docs/migrations.md).
export async function addMigration(root: string, name: string): Promise<string> {
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error(`The migration name "${name}" isn't snake_case: a-z, 0-9 and _ only`)
  }
  const dir = siteMigrationsPath(root)
  await mkdir(dir, { recursive: true })
  const file = path.join(dir, `${Date.now()}_${name}.ts`)
  await writeFile(file, MIGRATION_TEMPLATE, { flag: 'wx' })
  console.info(`bananacms: created ${path.relative(root, file)}`)
  return file
}

const MIGRATION_TEMPLATE = `import { createMigration } from '@reeywhaar/bananacms'

export default createMigration({
  async up(tx) {
    await tx.executeMultiple(\`
      -- TODO
    \`)
  },

  async down(tx) {
    await tx.executeMultiple(\`
      -- TODO
    \`)
  },
})
`
