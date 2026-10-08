import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

export interface SnapshotMeta {
  file: string
  path: string
  // when it was taken, as an ISO string
  createdAt: string
  // the start of the file's sha256, which its name carries
  hash: string
  sizeBytes: number
}

// as many of the sha256's hex digits as a snapshot's name carries
const HASH_LENGTH = 16

const FILENAME_RE =
  /^snapshot_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(\d{3})_([0-9a-f]{16})\.db$/

// snapshot_YYYYMMDD_HHmmssSSS_<hash>.db, in UTC so that the names sort in the
// order the snapshots were taken, year-round
export const snapshotFilename = (date: Date, hash: string): string => {
  const pad = (n: number, width = 2) => String(n).padStart(width, '0')
  const day = `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`
  const time = `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}${pad(date.getUTCMilliseconds(), 3)}`
  return `snapshot_${day}_${time}_${hash}.db`
}

// The start of a file's sha256, read in chunks: a snapshot is as large as the
// database, uploads and all.
export async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer)
  return hash.digest('hex').slice(0, HASH_LENGTH)
}

// the SQL dumps and diffs snapshots were before they were copies of the
// database, and the .tmp files they were written through
const SQL_SNAPSHOT_RE = /^snapshot_\d{8}_\d{9}(_\d+)?\.(sql|diff)(\.tmp)?$/

// The snapshots in `dir`, newest first: the CLI's n is [n - 1]
export async function listSnapshots(dir: string): Promise<SnapshotMeta[]> {
  const metas: SnapshotMeta[] = []
  for (const file of await readNames(dir)) {
    const match = FILENAME_RE.exec(file)
    if (!match) continue
    const [, year, month, day, hours, minutes, seconds, ms, hash] = match
    const path = join(dir, file)
    metas.push({
      file,
      path,
      createdAt: `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}Z`,
      hash,
      sizeBytes: (await stat(path)).size,
    })
  }
  return metas.sort((a, b) => b.file.localeCompare(a.file))
}

// the files in `dir` of the SQL snapshots of earlier versions
export async function listSqlSnapshots(dir: string): Promise<string[]> {
  return (await readNames(dir)).filter((file) => SQL_SNAPSHOT_RE.test(file))
}

async function readNames(dir: string): Promise<string[]> {
  try {
    return await readdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}
