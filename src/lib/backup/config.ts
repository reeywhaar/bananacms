// Relative imports and no TS parameter properties anywhere the CLI reaches:
// `node src/cli/index.ts` runs raw source, where Node's type stripping resolves
// neither @cms/* aliases nor parameter properties.
import { getCMS, isCMSInitialized } from '../../config.ts'
import { join } from 'node:path'

/**
 * What goes into an archive and what makes one happen.
 *
 * Two questions with three useful answers between them rather than two
 * switches with a meaningless fourth combination: "derived only, when the main
 * database changes" is not a policy anybody wants, and a pair of booleans
 * would offer it.
 */
export type BackupMode = 'main' | 'relaxed' | 'all'

export const BACKUP_MODES: BackupMode[] = ['main', 'relaxed', 'all']

export interface BackupConfig {
  /** Where an agent takes an archive. */
  url: string
  mode: BackupMode
  dbPath: string
  derivedDbPath: string
}

/**
 * How long after a change the copy goes out, and how long `all` will go
 * without sending anything.
 *
 * Constants, not settings. Neither is a number an operator can reason about
 * better than we can: the delay trades "how much of a burst becomes one
 * archive" against "how long a change sits uncopied", and the floor exists to
 * be a heartbeat rather than to protect anything. What an operator actually
 * chooses is which promise they want, and that is the mode.
 */
export const BACKUP_DELAY_MS = 5 * 60_000
export const BACKUP_ALL_PERIOD_MS = 30 * 60_000

/**
 * Returns null when backups are off: BACKUP_URL unset, or no database path can
 * be resolved. There is no default URL, because a default would be a guess at
 * a host we cannot see, and the failure it produces is a log line every few
 * minutes about somewhere nobody meant to send anything.
 */
export function getBackupConfig(): BackupConfig | null {
  const url = process.env.BACKUP_URL
  if (!url) return null

  const paths = resolveDbPaths()
  if (!paths) return null

  return { url, mode: parseMode(process.env.BACKUP_MODE), ...paths }
}

/** Whether the archive carries the derived database. */
export const carriesDerived = (mode: BackupMode): boolean => mode !== 'main'

/**
 * How long a mode will go without sending anything, or 0 for no floor.
 *
 * Only `all` has one. Every mode sends when the main database changes; this is
 * the extra promise one of them makes on top.
 */
export const backupPeriodMs = (mode: BackupMode): number =>
  mode === 'all' ? BACKUP_ALL_PERIOD_MS : 0

/**
 * `relaxed` rather than `main`, because derived.db is a fraction of the archive
 * and holds the sessions that would otherwise sign everybody out. Not `all`,
 * because a floor is a heartbeat for an operator who has set one up, and
 * sending an archive every half hour to an instance nobody configured that for
 * is postage spent on nothing.
 */
const parseMode = (raw: string | undefined): BackupMode => {
  if (raw === undefined || raw === '') return 'relaxed'
  if ((BACKUP_MODES as string[]).includes(raw)) return raw as BackupMode
  console.warn(`BACKUP_MODE=${raw} is not one of ${BACKUP_MODES.join(', ')}; using relaxed`)
  return 'relaxed'
}

const resolveDbPaths = (): { dbPath: string; derivedDbPath: string } | null => {
  if (isCMSInitialized()) {
    const { dbPath, derivedDbPath } = getCMS().env
    return { dbPath, derivedDbPath }
  }
  const dataPath = process.env.DATA_PATH
  if (!dataPath) return null
  return { dbPath: join(dataPath, 'database.db'), derivedDbPath: join(dataPath, 'derived.db') }
}
