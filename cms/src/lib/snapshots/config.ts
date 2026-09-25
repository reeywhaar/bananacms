import { dirname, join } from 'node:path'

export interface SnapshotsConfig {
  // how many snapshots are kept
  count: number
  // how long a snapshot waits after the first write it will hold, so that a burst
  // of writes makes one snapshot
  delayMs: number
  // the directory the snapshot files are in
  dir: string
  // the database they're snapshots of
  dbPath: string
}

const DEFAULT_DELAY_SECONDS = 600

export const snapshotsDirFor = (dbPath: string): string => join(dirname(dbPath), 'snapshots')

// Snapshots of database.db in `dataDir`, into its snapshots/ directory, when
// SNAPSHOTS_COUNT is above 0: that many are kept. SNAPSHOTS_DELAY is the delay in
// seconds, 600 by default. null when snapshots are off.
export function snapshotsConfig(dataDir: string): SnapshotsConfig | null {
  const count = parsePositiveInt(process.env.SNAPSHOTS_COUNT, 'SNAPSHOTS_COUNT')
  if (count === null) return null
  const dbPath = join(dataDir, 'database.db')
  const delaySeconds =
    parsePositiveInt(process.env.SNAPSHOTS_DELAY, 'SNAPSHOTS_DELAY') ?? DEFAULT_DELAY_SECONDS
  return { count, delayMs: delaySeconds * 1000, dir: snapshotsDirFor(dbPath), dbPath }
}

const parsePositiveInt = (raw: string | undefined, name: string): number | null => {
  if (raw === undefined || raw === '') return null
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 0) {
    console.warn(`${name}=${raw} is not a whole number of 0 or more; ignoring it`)
    return null
  }
  return value > 0 ? value : null
}
