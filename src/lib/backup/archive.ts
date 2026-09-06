import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@libsql/client'
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
   * Identifies the main database's contents, and nothing else's.
   *
   * Taken from the vacuumed bytes rather than from the tarball, because gzip
   * and tar both carry timestamps — two archives of one unchanged database
   * differ, which is exactly the question this is asked to answer. `VACUUM
   * INTO` writes pages in a defined order, so identical contents produce
   * identical bytes; where that ever stopped being true the cost is a
   * redundant upload rather than a missed one, which is the right way for this
   * to fail.
   */
  digest: string
  cleanup(): Promise<void>
}

/**
 * Copies the main database out and hashes it.
 *
 * `VACUUM INTO` is the whole reason this exists rather than a `tar` over the
 * data directory. A SQLite database in WAL mode is not one file: it is
 * database.db, -wal and -shm, with committed state spread across them. Copy
 * those at slightly different moments — which is what any file-level backup of
 * a running service does — and what you have restored is a database as it
 * never was. `VACUUM INTO` asks SQLite for the database as of one read
 * transaction, log folded in, and hands back a self-contained file.
 *
 * Only the main database, and only hashed: this runs on every pass that gets
 * past the cheap check, while packing an archive does not. The caller keeps
 * the staged copy if it decides to send one, so the main database is never
 * vacuumed twice for the same backup.
 */
export async function stageBackup(dbPath: string): Promise<StagedBackup> {
  // A directory of this process's own rather than the data directory: VACUUM
  // INTO refuses to overwrite, so it needs somewhere nothing else is writing,
  // and a failed run should not leave a half-written database beside the real
  // ones where the next thing along might mistake it for one.
  const dir = await mkdtemp(join(tmpdir(), 'bananacms-backup-'))
  const cleanup = () => rm(dir, { recursive: true, force: true })
  try {
    const mainPath = join(dir, MAIN_FILE)
    await vacuumInto(dbPath, mainPath)
    return { dir, mainPath, digest: await digestFile(mainPath), cleanup }
  } catch (error) {
    await cleanup()
    throw error
  }
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

async function vacuumInto(dbPath: string, outPath: string): Promise<void> {
  const client = createClient({ url: `file:${dbPath}` })
  try {
    await client.execute({ sql: 'VACUUM INTO ?', args: [outPath] })
  } finally {
    client.close()
  }
}

/** Streamed: the database is as large as the site's media. */
async function digestFile(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}
