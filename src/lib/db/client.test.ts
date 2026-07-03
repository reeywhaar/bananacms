import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDb, openDerivedDb, runMigrations } from './client'

const dirs: string[] = []
const closers: Array<() => void> = []

afterEach(() => {
  for (const close of closers.splice(0)) close()
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

async function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'bananacms-client-'))
  dirs.push(dir)
  const { client, db } = await openDb(join(dir, 'database.db'))
  const { client: derivedClient } = await openDerivedDb(join(dir, 'derived.db'))
  closers.push(() => {
    client.close()
    derivedClient.close()
  })
  return { client, db, derivedClient }
}

describe('runMigrations', () => {
  it('normalizes the legacy migrations table (up/down columns) and can record new migrations', async () => {
    const { client, derivedClient } = await setup()

    // The pre-bookkeeping format: migration SQL stored in NOT NULL columns.
    // Databases from that era keep this shape via CREATE TABLE IF NOT EXISTS,
    // and the first newly shipped migration used to fail its
    // INSERT INTO migrations (id, name) on the NOT NULL `up`.
    await client.executeMultiple(`
      CREATE TABLE "migrations" (
        id   INTEGER PRIMARY KEY,
        name TEXT    NOT NULL,
        up   TEXT    NOT NULL,
        down TEXT    NOT NULL
      );
      INSERT INTO migrations VALUES (999999999998, 'sentinel', 'CREATE TABLE x (id);', 'DROP TABLE x;');
    `)

    await runMigrations(client, derivedClient)

    const info = await client.execute('PRAGMA table_info(migrations)')
    expect(info.rows.map((r) => r.name).sort()).toEqual(['id', 'name'])

    const rows = await client.execute('SELECT id, name FROM migrations ORDER BY id')
    const names = rows.rows.map((r) => r.name)
    expect(names).toContain('sentinel') // legacy bookkeeping preserved
    expect(names).toContain('initial') // real migrations were applied and recorded
    expect(names.length).toBeGreaterThan(2)
  })

  it('leaves the current-format migrations table untouched', async () => {
    const { client, derivedClient } = await setup()
    await runMigrations(client, derivedClient)
    const before = (await client.execute('SELECT id, name FROM migrations ORDER BY id')).rows

    // Second run must be a no-op, not a re-application.
    await runMigrations(client, derivedClient)
    const after = (await client.execute('SELECT id, name FROM migrations ORDER BY id')).rows
    expect(after).toEqual(before)
  })
})
