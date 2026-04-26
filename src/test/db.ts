import { fileURLToPath } from 'node:url'
import { Database, open } from 'sqlite'
import sqlite3 from 'sqlite3'

const MIGRATIONS_PATH = fileURLToPath(new URL('../lib/migrations', import.meta.url))

export async function createTestDb(): Promise<Database> {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database })
  await db.run('PRAGMA foreign_keys = OFF')
  await db.migrate({ migrationsPath: MIGRATIONS_PATH })
  await db.run('PRAGMA foreign_keys = ON')
  return db
}
