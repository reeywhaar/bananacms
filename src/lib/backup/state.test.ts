import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDb, openDerivedDb, runMigrations } from '../db/client'
import { ensureBackupState, readBackupState, recordBackup } from './state'

const dirs: string[] = []
const closers: Array<() => void> = []

afterEach(() => {
  for (const close of closers.splice(0)) close()
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

async function migrated() {
  const dir = mkdtempSync(join(tmpdir(), 'bananacms-backup-state-'))
  dirs.push(dir)
  const { client } = await openDb(join(dir, 'database.db'))
  const { client: derivedClient } = await openDerivedDb(join(dir, 'derived.db'))
  closers.push(() => {
    client.close()
    derivedClient.close()
  })
  await runMigrations(client, derivedClient)
  return derivedClient
}

describe('backup state', () => {
  it('is created in derived.db by the migrations, empty', async () => {
    const derived = await migrated()
    expect(await readBackupState(derived)).toBeNull()
  })

  it('round-trips the digest and keeps exactly one row', async () => {
    const derived = await migrated()
    const at = new Date('2026-02-03T04:05:06Z')
    await recordBackup(derived, 'a'.repeat(64), at)

    const first = await readBackupState(derived)
    expect(first?.digest).toBe('a'.repeat(64))
    // Stored as whole seconds.
    expect(first?.pushedAt.toISOString()).toBe('2026-02-03T04:05:06.000Z')

    await recordBackup(derived, 'b'.repeat(64), new Date('2026-02-03T05:00:00Z'))
    expect((await readBackupState(derived))?.digest).toBe('b'.repeat(64))
    const { rows } = await derived.execute('SELECT COUNT(*) AS n FROM backup_state')
    expect(Number(rows[0].n)).toBe(1)
  })
})

describe('a lost derived.db', () => {
  it('recreates its own state table, because migrations will not', async () => {
    const derived = await migrated()
    await recordBackup(derived, 'a'.repeat(64), new Date('2026-02-03T04:05:06Z'))

    // What losing derived.db looks like: the table is gone, and the migration
    // that made it is still recorded in the *main* database, so re-running
    // migrations brings nothing back.
    await derived.execute('DROP TABLE backup_state')
    await expect(readBackupState(derived)).rejects.toThrow(/no such table/)

    await ensureBackupState(derived)
    // Empty rather than stale: the agent's copy is unknown again, so the next
    // pass sends one. A redundant upload, never a missed one.
    expect(await readBackupState(derived)).toBeNull()
  })

  it('is a no-op when the table is already there', async () => {
    const derived = await migrated()
    await recordBackup(derived, 'c'.repeat(64), new Date('2026-02-03T04:05:06Z'))
    await ensureBackupState(derived)
    expect((await readBackupState(derived))?.digest).toBe('c'.repeat(64))
  })
})
