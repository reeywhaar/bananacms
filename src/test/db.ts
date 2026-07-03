import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb, openDerivedDb, runMigrations, type Db, type DerivedDb } from '@cms/lib/db/client'
import type { Client } from '@libsql/client'

export type TestDb = {
  client: Client
  db: Db
  derivedClient: Client
  derivedDb: DerivedDb
  /** Symbol.dispose lets callers say `using testDb = await createTestDb()`. */
  [Symbol.dispose](): void
}

/**
 * libsql opens a fresh `:memory:` DB per connection, so transactions can't
 * see tables on the main connection. We sidestep that by giving each test a
 * private temp file. Use with the Disposable pattern:
 *
 *   it('...', async () => {
 *     using testDb = await createTestDb()
 *     // ... use testDb.db / testDb.derivedDb
 *   })
 *
 * The temp files + libsql clients are torn down at scope exit; no afterEach
 * required.
 */
export async function createTestDb(): Promise<TestDb> {
  const dir = mkdtempSync(join(tmpdir(), 'bananacms-test-'))
  const { client, db } = await openDb(join(dir, 'db.sqlite'))
  const { client: derivedClient, db: derivedDb } = await openDerivedDb(join(dir, 'derived.sqlite'))
  await runMigrations(client, derivedClient)
  return {
    client,
    db,
    derivedClient,
    derivedDb,
    [Symbol.dispose]() {
      client.close()
      derivedClient.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}
