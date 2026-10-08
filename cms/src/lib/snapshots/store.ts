import { copyFile, mkdir, open, rename, rm, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { createClient, type Client } from '@libsql/client'
import type { Logger } from '../logger/Logger.ts'
import type { SnapshotsConfig } from './config.ts'
import { hashFile, listSnapshots, snapshotFilename, type SnapshotMeta } from './files.ts'

export type CreateResult = 'created' | 'skipped-unchanged' | 'skipped-locked'

const LOCK_STALE_MS = 60_000

// where a snapshot is written before it's known to be new, in the snapshots'
// directory, so that it's renamed into place rather than copied
const PENDING_FILE = '.pending.db'

// A snapshot is a copy of the database file, made with SQLite's VACUUM INTO: the
// database as of one read transaction, with the -wal folded in, written page by
// page, so a database of any size passes through no more memory than SQLite's
// page cache. A copy of unchanged content is the same bytes, so the hash in a
// snapshot's name tells whether the database has changed since.
export class SnapshotStore {
  private readonly config: SnapshotsConfig
  private readonly logger?: Logger

  constructor(config: SnapshotsConfig, logger?: Logger) {
    this.config = config
    this.logger = logger
  }

  // Copies the database, through `client`, and keeps the copy unless it's the
  // same as the newest snapshot; then removes the oldest past SNAPSHOTS_COUNT.
  // Callers at once, the site's server and the CLI, take turns by a lock file:
  // the one that finds it taken skips rather than waits.
  async createSnapshot(client: Client): Promise<CreateResult> {
    await mkdir(this.config.dir, { recursive: true })
    return this.withLock(async () => {
      const pending = join(this.config.dir, PENDING_FILE)
      // one left by a snapshot that was cut short; VACUUM INTO won't overwrite it
      await rm(pending, { force: true })
      try {
        await client.execute({ sql: 'VACUUM INTO ?', args: [pending] })
        const hash = await hashFile(pending)
        const newest = (await listSnapshots(this.config.dir))[0]
        if (newest?.hash === hash) return 'skipped-unchanged'
        const path = join(this.config.dir, snapshotFilename(new Date(), hash))
        await rename(pending, path)
        this.logger?.info('snapshot written', { file: path })
      } finally {
        await rm(pending, { force: true })
      }
      await this.removeOldest()
      return 'created'
    })
  }

  // Replaces the database with the snapshot at `index`, 1 being the newest, once
  // the app has stopped: a running one keeps the old file open. The snapshot is
  // copied beside the database and checked first: its hash, SQLite's integrity
  // check, and its migrations. Only then is the database as it is snapshotted,
  // so that the restore can be undone, which can remove the oldest snapshot,
  // the one being restored perhaps. A failure on the way leaves the database as
  // it was.
  async restore(index: number): Promise<void> {
    const target = await this.snapshotAt(index)
    const restoring = `${this.config.dbPath}.restore-tmp`
    await removeDbFiles(restoring)
    try {
      await copyFile(target.path, restoring)
      if ((await hashFile(restoring)) !== target.hash) {
        throw new Error(`${target.file} isn't the file its name says: it has changed since`)
      }
      await checkDatabase(restoring)

      const current = createClient({ url: `file:${this.config.dbPath}` })
      try {
        const result = await this.createSnapshot(current)
        if (result === 'skipped-locked') {
          throw new Error('another process is snapshotting right now; try again')
        }
      } finally {
        current.close()
      }
    } catch (error) {
      await removeDbFiles(restoring)
      throw error
    }

    await rename(restoring, this.config.dbPath)
    await rm(`${this.config.dbPath}-wal`, { force: true })
    await rm(`${this.config.dbPath}-shm`, { force: true })
  }

  private async snapshotAt(index: number): Promise<SnapshotMeta> {
    const snapshots = await listSnapshots(this.config.dir)
    const snapshot = Number.isInteger(index) && index >= 1 ? snapshots[index - 1] : undefined
    if (!snapshot) {
      throw new Error(`No snapshot at index ${index} (${snapshots.length} available)`)
    }
    return snapshot
  }

  private async removeOldest(): Promise<void> {
    const snapshots = await listSnapshots(this.config.dir)
    for (const snapshot of snapshots.slice(this.config.count)) {
      await unlink(snapshot.path)
      this.logger?.info('snapshot removed', { file: snapshot.file })
    }
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T | 'skipped-locked'> {
    const lockPath = join(this.config.dir, '.lock')
    let handle = await tryAcquire(lockPath)
    if (!handle) {
      const lockStat = await stat(lockPath).catch(() => null)
      if (!lockStat || Date.now() - lockStat.mtimeMs <= LOCK_STALE_MS) {
        this.logger?.debug('snapshot lock is held; skipping')
        return 'skipped-locked'
      }
      this.logger?.warn('stealing stale snapshot lock')
      await rm(lockPath, { force: true })
      handle = await tryAcquire(lockPath)
      if (!handle) return 'skipped-locked'
    }
    try {
      await handle.writeFile(`${process.pid} ${new Date().toISOString()}\n`)
      return await fn()
    } finally {
      await handle.close()
      await rm(lockPath, { force: true })
    }
  }
}

// SQLite's integrity check, and a migrations table: a database of the site's
async function checkDatabase(dbPath: string): Promise<void> {
  const client = createClient({ url: `file:${dbPath}` })
  try {
    const integrity = await client.execute('PRAGMA integrity_check')
    const verdict = String(integrity.rows[0]?.[0] ?? '')
    if (integrity.rows.length !== 1 || verdict !== 'ok') {
      throw new Error(`integrity_check failed on the snapshot: ${verdict}`)
    }
    await client.execute('SELECT count(*) FROM migrations')
  } finally {
    client.close()
  }
  await rm(`${dbPath}-wal`, { force: true })
  await rm(`${dbPath}-shm`, { force: true })
}

async function tryAcquire(lockPath: string) {
  try {
    return await open(lockPath, 'wx')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return null
    throw error
  }
}

async function removeDbFiles(dbPath: string): Promise<void> {
  await rm(dbPath, { force: true })
  await rm(`${dbPath}-wal`, { force: true })
  await rm(`${dbPath}-shm`, { force: true })
}
