import { join } from 'node:path'

// What an archive carries, and what makes one go out: `main` sends database.db,
// `relaxed` adds derived.db, whose sessions keep everybody signed in after a
// restore, and `all` also sends every half hour, so the agent can tell a stalled
// site from a quiet one. Every mode sends when database.db changes.
export type BackupMode = 'main' | 'relaxed' | 'all'

export const BACKUP_MODES: BackupMode[] = ['main', 'relaxed', 'all']

export interface BackupConfig {
  // where a backup agent takes archives, with a POST
  url: string
  mode: BackupMode
  dbPath: string
  derivedDbPath: string
}

// How long after a change its copy goes out, which makes a burst of changes one
// archive, and how long `all` goes without sending
export const BACKUP_DELAY_MS = 5 * 60_000
export const BACKUP_ALL_PERIOD_MS = 30 * 60_000

// Backups of the databases in `dataDir` to BACKUP_URL, in BACKUP_MODE, `relaxed`
// by default. null when BACKUP_URL isn't set: there's no default agent.
export function backupConfig(dataDir: string): BackupConfig | null {
  const url = process.env.BACKUP_URL
  if (!url) return null
  return {
    url,
    mode: parseMode(process.env.BACKUP_MODE),
    dbPath: join(dataDir, 'database.db'),
    derivedDbPath: join(dataDir, 'derived.db'),
  }
}

// whether the archive carries derived.db
export const carriesDerived = (mode: BackupMode): boolean => mode !== 'main'

// how long a mode goes without sending anything, or 0 for as long as nothing
// changes
export const backupPeriodMs = (mode: BackupMode): number =>
  mode === 'all' ? BACKUP_ALL_PERIOD_MS : 0

const parseMode = (raw: string | undefined): BackupMode => {
  if (raw === undefined || raw === '') return 'relaxed'
  if ((BACKUP_MODES as string[]).includes(raw)) return raw as BackupMode
  console.warn(`BACKUP_MODE=${raw} is not one of ${BACKUP_MODES.join(', ')}; using relaxed`)
  return 'relaxed'
}
