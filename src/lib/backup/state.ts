import type { Client } from '@libsql/client'

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
