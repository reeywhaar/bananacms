import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb, runMigrations, type Db } from '@cms/lib/db/client'
import type { Client } from '@libsql/client'

export type TestDb = {
  client: Client
  db: Db
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
 *     // ... use testDb.db
 *   })
 *
 * The temp file + libsql client are torn down at scope exit; no afterEach
 * required.
 */
export async function createTestDb(): Promise<TestDb> {
  const dir = mkdtempSync(join(tmpdir(), 'bananacms-test-'))
  const dbPath = join(dir, 'db.sqlite')
  const { client, db } = openDb(dbPath)
  await runMigrations(client)
  return {
    client,
    db,
    [Symbol.dispose]() {
      client.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}
