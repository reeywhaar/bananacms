import type { Client } from '@libsql/client'

const BACKUP_STATE_TABLE = `
  CREATE TABLE IF NOT EXISTS backup_state (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    digest    TEXT    NOT NULL,
    pushedAt  INTEGER NOT NULL
  )
`

/**
 * Creates the table if it is not there.
 *
 * derived.db is the disposable database — it can arrive empty on a new volume
 * or be wiped deliberately — and migration bookkeeping lives in the *main*
 * database, so once the migration is recorded there, re-running migrations
 * will never bring a lost derived table back. Left to the migration alone, an
 * instance that lost derived.db would read "no such table" on every pass and
 * quietly stop backing up. The state is this subsystem's own, so it makes it
 * rather than depending on a migration having run; the migration stays the
 * canonical schema for instances that already have it.
 */
export async function ensureBackupState(derivedClient: Client): Promise<void> {
  await derivedClient.execute(BACKUP_STATE_TABLE)
}

export interface BackupState {
  /** Digest of the main database as the agent last accepted it. */
  digest: string
  pushedAt: Date
}

/** What the agent last accepted, or null if it never has. */
export async function readBackupState(derivedClient: Client): Promise<BackupState | null> {
  const { rows } = await derivedClient.execute(
    'SELECT digest, pushedAt FROM backup_state WHERE singleton = 1',
  )
  const row = rows[0]
  if (!row) return null
  return { digest: String(row.digest), pushedAt: new Date(Number(row.pushedAt) * 1000) }
}

/**
 * Remembers what was sent, so an unchanged database is not sent again.
 *
 * Written only after the agent has accepted the archive. Recorded before, a
 * rejected upload would leave us believing a copy exists that does not — and
 * the next write to the database would be the only thing that ever made it try
 * again.
 */
export async function recordBackup(derivedClient: Client, digest: string, at: Date): Promise<void> {
  await derivedClient.execute({
    sql: `INSERT INTO backup_state (singleton, digest, pushedAt) VALUES (1, ?, ?)
            ON CONFLICT (singleton) DO UPDATE SET
              digest = excluded.digest, pushedAt = excluded.pushedAt`,
    args: [digest, Math.floor(at.getTime() / 1000)],
  })
}
