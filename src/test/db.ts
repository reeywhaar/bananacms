import { fileURLToPath } from 'node:url'
import { openDb, runMigrations, type Db } from '@cms/lib/db/client'
import type { Client } from '@libsql/client'

const MIGRATIONS_PATH = fileURLToPath(new URL('../lib/migrations', import.meta.url))

export type TestDb = { client: Client; db: Db }

export async function createTestDb(): Promise<TestDb> {
  const { client, db } = openDb(':memory:')
  await client.execute('PRAGMA foreign_keys = OFF')
  await runMigrations(client, MIGRATIONS_PATH)
  await client.execute('PRAGMA foreign_keys = ON')
  return { client, db }
}
