import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'

const MIGRATIONS_PATH = fileURLToPath(new URL('../lib/migrations', import.meta.url))

export async function run({ force = false }: { force?: boolean }): Promise<void> {
  const dbPath = requireEnv('DB_PATH')

  await mkdir(dirname(resolve(dbPath)), { recursive: true })

  const db = await open({ filename: dbPath, driver: sqlite3.Database })

  // Migrations recreate tables (CREATE new / copy / DROP old / RENAME), which is
  // unsafe with FK enforcement on — DROP cascades ON DELETE actions to referring
  // tables. Standard SQLite practice: disable FKs during migration, verify after.
  await db.run('PRAGMA foreign_keys = OFF')

  console.info(`bananacms: running migrations on ${dbPath}${force ? ' (force)' : ''}...`)
  await db.migrate({ migrationsPath: MIGRATIONS_PATH, force })

  const violations = await db.all('PRAGMA foreign_key_check')
  if (violations.length > 0) {
    console.error('Foreign key violations after migration:')
    console.error(violations)
    await db.close()
    process.exit(1)
  }

  await db.close()
  console.info('bananacms: migrations complete.')
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`${name} is not set. Provide it via .env or the environment.`)
    process.exit(1)
  }
  return v
}
