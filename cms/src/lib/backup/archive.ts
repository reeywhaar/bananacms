import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { vacuumInto } from '../db/vacuumInto.ts'
import { writeTarGz, type TarEntry } from './tar.ts'

export const MAIN_FILE = 'database.db'
export const DERIVED_FILE = 'derived.db'

/** The archive's name, timestamped so a backup store can keep a series. */
export const archiveFilename = (now: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`
  const time = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  return `bananacms-${day}_${time}.tgz`
}

export interface StagedBackup {
  /** Private directory holding the vacuumed copies. */
  dir: string
  mainPath: string
  /**
   * The main database's sha256, of the vacuumed copy rather than the archive:
   * tar and gzip carry timestamps, while `VACUUM INTO` writes the same contents
   * as the same bytes.
   */
  digest: string
  /** Removes the directory: `await using staged = await stageBackup(dbPath)`. */
  [Symbol.asyncDispose](): Promise<void>
}

/**
 * Copies the main database out with `VACUUM INTO`, and hashes the copy. Copying
 * database.db, -wal and -shm as files could catch them at different moments;
 * `VACUUM INTO` gives the database as of one read transaction, in one file. The
 * caller packs this copy if it sends one, so it's vacuumed once per backup.
 */
export async function stageBackup(dbPath: string): Promise<StagedBackup> {
  await using stack = new AsyncDisposableStack()
  // not the data directory, where a half-written copy would sit beside the real
  // databases; and VACUUM INTO won't overwrite
  const dir = await mkdtemp(join(tmpdir(), 'bananacms-backup-'))
  stack.defer(() => rm(dir, { recursive: true, force: true }))
  const mainPath = join(dir, MAIN_FILE)
  await vacuumInto(dbPath, mainPath)
  const digest = await digestFile(mainPath)
  const owned = stack.move()
  return { dir, mainPath, digest, [Symbol.asyncDispose]: () => owned.disposeAsync() }
}

/**
 * Adds the derived database when the mode carries it, and writes the archive.
 * Returns the path of the .tgz, inside the staged directory.
 */
export async function packArchive(
  staged: StagedBackup,
  derivedDbPath: string | null,
  now: Date = new Date(),
): Promise<{ path: string; bytes: number }> {
  const entries: TarEntry[] = [
    // The main database first: it is what has to survive, so it is the first
    // thing out of the archive and the first thing back into a data directory.
    { name: MAIN_FILE, path: staged.mainPath, size: (await stat(staged.mainPath)).size },
  ]

  // A derived database that was never created is not an error: it is rebuilt
  // by migrations, and its absence costs a sign-in.
  if (derivedDbPath !== null && existsSync(derivedDbPath)) {
    const derivedPath = join(staged.dir, DERIVED_FILE)
    await vacuumInto(derivedDbPath, derivedPath)
    entries.push({ name: DERIVED_FILE, path: derivedPath, size: (await stat(derivedPath)).size })
  }

  const path = join(staged.dir, 'archive.tgz')
  await writeTarGz(entries, path, now)
  return { path, bytes: (await stat(path)).size }
}

/** Streamed: the database is as large as the site's media. */
async function digestFile(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}
