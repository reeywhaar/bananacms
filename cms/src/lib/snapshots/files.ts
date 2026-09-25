import { open, readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

export type SnapshotKind = 'full' | 'diff'

export interface SnapshotHeader {
  kind: SnapshotKind
  createdAt: string
  /** sha256 of the FULL dump text this snapshot represents (not of the file). */
  hash: string
  /** For diff snapshots: hash of the predecessor snapshot. */
  parentHash?: string
}

export interface SnapshotMeta extends SnapshotHeader {
  file: string
  path: string
  sizeBytes: number
}

const HEADER_MAGIC = '-- bananacms-snapshot v1'
const HEADER_FIELD_RE = /^-- ([a-z-]+): (.*)$/
// Enough for the magic line plus four fields.
const HEADER_READ_BYTES = 1024

const FILENAME_RE = /^snapshot_\d{8}_\d{9}(_\d+)?\.(sql|diff)$/

/**
 * snapshot_YYYYMMDD_HHmmssSSS.<sql|diff>, in UTC so lexicographic order
 * matches creation order year-round.
 */
export const snapshotFilename = (date: Date, kind: SnapshotKind, suffix?: number): string => {
  const pad = (n: number, width = 2) => String(n).padStart(width, '0')
  const day = `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`
  const time = `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}${pad(date.getUTCMilliseconds(), 3)}`
  const dedupe = suffix === undefined ? '' : `_${suffix}`
  return `snapshot_${day}_${time}${dedupe}.${kind === 'full' ? 'sql' : 'diff'}`
}

export const serializeSnapshot = (header: SnapshotHeader, body: string): string => {
  const lines = [
    HEADER_MAGIC,
    `-- kind: ${header.kind}`,
    `-- created: ${header.createdAt}`,
    `-- hash: ${header.hash}`,
  ]
  if (header.parentHash !== undefined) lines.push(`-- parent-hash: ${header.parentHash}`)
  return `${lines.join('\n')}\n${body}`
}

export const parseSnapshotHeader = (content: string): SnapshotHeader | null => {
  const lines = content.split('\n')
  if (lines[0] !== HEADER_MAGIC) return null
  const fields: Record<string, string> = {}
  for (let i = 1; i < lines.length; i++) {
    const match = HEADER_FIELD_RE.exec(lines[i])
    if (!match) break
    fields[match[1]] = match[2]
  }
  const kind = fields['kind']
  if ((kind !== 'full' && kind !== 'diff') || !fields['created'] || !fields['hash']) return null
  return {
    kind,
    createdAt: fields['created'],
    hash: fields['hash'],
    parentHash: fields['parent-hash'],
  }
}

/** The snapshot payload: the full dump for .sql files, the patch for .diff files. */
export async function readSnapshotBody(path: string): Promise<string> {
  const content = await readFile(path, 'utf8')
  const lines = content.split('\n')
  let start = 0
  if (lines[0] === HEADER_MAGIC) {
    start = 1
    while (start < lines.length && HEADER_FIELD_RE.test(lines[start])) start++
  }
  return lines.slice(start).join('\n')
}

/** Snapshots in `dir`, sorted newest first — CLI index n maps to `[n - 1]`. */
export async function listSnapshots(dir: string): Promise<SnapshotMeta[]> {
  let names: string[]
  try {
    names = await readdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }

  const metas: SnapshotMeta[] = []
  for (const name of names.filter((n) => FILENAME_RE.test(n))) {
    const path = join(dir, name)
    const header = await readSnapshotHeaderFromFile(path)
    if (!header) continue
    metas.push({ ...header, file: name, path, sizeBytes: (await stat(path)).size })
  }
  // Order by the created header (millisecond ISO), not by filename: same-stamp
  // files would tie-break on the .diff/.sql extension — the wrong order.
  // Writes are serialized by the lock file, so created stamps are distinct in
  // practice.
  return metas.sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.file.localeCompare(a.file),
  )
}

async function readSnapshotHeaderFromFile(path: string): Promise<SnapshotHeader | null> {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(HEADER_READ_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, HEADER_READ_BYTES, 0)
    return parseSnapshotHeader(buffer.subarray(0, bytesRead).toString('utf8'))
  } finally {
    await handle.close()
  }
}
