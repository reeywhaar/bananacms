// Relative imports and no TS parameter properties anywhere the snapshot CLI
// reaches: `node src/cli/index.ts` runs raw source, where Node's type
// stripping resolves neither @cms/* aliases nor parameter properties.
import { dirname, join } from 'node:path'
import { getCMS, isCMSInitialized } from '../../config.ts'

export interface SnapshotsConfig {
  /** Max snapshots kept; > 0 means the feature is enabled. */
  count: number
  /** Debounce between the first DB write and the snapshot that captures it. */
  delayMs: number
  /** Directory the snapshot files live in. */
  dir: string
  /** Path of the main database file being snapshotted. */
  dbPath: string
}

const DEFAULT_DELAY_SECONDS = 600

export const snapshotsDirFor = (dbPath: string): string => join(dirname(dbPath), 'snapshots')

/**
 * Returns null when snapshotting is disabled: SNAPSHOTS_COUNT unset, 0, or
 * invalid, or no database path can be resolved.
 */
export function getSnapshotsConfig(): SnapshotsConfig | null {
  const count = parsePositiveInt(process.env.SNAPSHOTS_COUNT, 'SNAPSHOTS_COUNT')
  if (count === null) return null

  const dbPath = resolveDbPath()
  if (!dbPath) return null

  const delaySeconds =
    parsePositiveInt(process.env.SNAPSHOTS_DELAY, 'SNAPSHOTS_DELAY') ?? DEFAULT_DELAY_SECONDS

  return { count, delayMs: delaySeconds * 1000, dir: snapshotsDirFor(dbPath), dbPath }
}

const resolveDbPath = (): string | null => {
  if (isCMSInitialized()) return getCMS().env.dbPath
  const dataPath = process.env.DATA_PATH
  return dataPath ? join(dataPath, 'database.db') : null
}

const parsePositiveInt = (raw: string | undefined, name: string): number | null => {
  if (raw === undefined || raw === '') return null
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 0) {
    console.warn(`${name}=${raw} is not a non-negative integer; ignoring`)
    return null
  }
  return value > 0 ? value : null
}
