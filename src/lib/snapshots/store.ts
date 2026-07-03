import { existsSync } from 'node:fs'
import { mkdir, open, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createClient, type Client } from '@libsql/client'
import type { Logger } from '../logger/Logger.ts'
import type { SnapshotsConfig } from './config.ts'
import { createDiff, applyDiff } from './diff.ts'
import { dumpDatabase, hashDump } from './dump.ts'
import {
  listSnapshots,
  readSnapshotBody,
  serializeSnapshot,
  snapshotFilename,
  type SnapshotHeader,
  type SnapshotMeta,
} from './files.ts'

export type CreateResult = 'created' | 'skipped-unchanged' | 'skipped-locked'

const LOCK_STALE_MS = 60_000

export class SnapshotStore {
  private readonly config: SnapshotsConfig
  private readonly logger?: Logger

  constructor(config: SnapshotsConfig, logger?: Logger) {
    this.config = config
    this.logger = logger
  }

  /**
   * Dumps the database and stores it: as a full .sql snapshot when it is the
   * first one (or the diff chain is broken), otherwise as a .diff against the
   * previous snapshot. Concurrent callers (the two Next zones, the CLI) are
   * serialized by a lock file; losers skip instead of waiting.
   */
  async createSnapshot(client: Client): Promise<CreateResult> {
    await mkdir(this.config.dir, { recursive: true })
    return this.withLock(async () => {
      const dump = await dumpDatabase(client)
      const hash = hashDump(dump)
      const snapshots = await listSnapshots(this.config.dir)
      const newest = snapshots[0]

      if (newest?.hash === hash) return 'skipped-unchanged'

      if (!newest) {
        await this.writeSnapshot({ kind: 'full', hash }, dump)
      } else {
        const newestText = await this.reconstructText(snapshots, 0)
        if (newestText === null) {
          this.logger?.error('snapshot chain is broken; writing a full snapshot')
          await this.writeSnapshot({ kind: 'full', hash }, dump)
        } else {
          const patch = createDiff(newestText, dump)
          await this.writeSnapshot({ kind: 'diff', hash, parentHash: newest.hash }, patch)
        }
      }

      await this.cleanup()
      return 'created'
    })
  }

  /** Full SQL dump of the snapshot at `index` (1 = newest). */
  async reconstruct(index: number): Promise<string> {
    const snapshots = await listSnapshots(this.config.dir)
    if (!Number.isInteger(index) || index < 1 || index > snapshots.length) {
      throw new Error(`No snapshot at index ${index} (${snapshots.length} available)`)
    }
    const text = await this.reconstructText(snapshots, index - 1)
    if (text === null) {
      throw new Error(`Snapshot chain is broken; cannot reconstruct index ${index}`)
    }
    return text
  }

  /**
   * Replaces the live database with the snapshot at `index` (1 = newest).
   * The current state is snapshotted first, and the restored database is
   * materialized and integrity-checked in a temp file before the atomic
   * rename — a failure at any point leaves the live database untouched.
   * The app must be stopped: running processes keep the old file open.
   */
  async restore(index: number): Promise<void> {
    const dump = await this.reconstruct(index)

    const currentClient = createClient({ url: `file:${this.config.dbPath}` })
    try {
      const result = await this.createSnapshot(currentClient)
      if (result === 'skipped-locked') {
        throw new Error('another process is snapshotting right now; try again')
      }
    } finally {
      currentClient.close()
    }

    const tmpPath = `${this.config.dbPath}.restore-tmp`
    await removeDbFiles(tmpPath)
    const tmpClient = createClient({ url: `file:${tmpPath}` })
    try {
      await tmpClient.executeMultiple(dump)
      const integrity = await tmpClient.execute('PRAGMA integrity_check')
      const verdict = String(integrity.rows[0]?.[0] ?? '')
      if (integrity.rows.length !== 1 || verdict !== 'ok') {
        throw new Error(`integrity_check failed on the restored database: ${verdict}`)
      }
      await tmpClient.execute('SELECT count(*) FROM migrations')
    } catch (error) {
      tmpClient.close()
      await removeDbFiles(tmpPath)
      throw error
    }
    tmpClient.close()
    await rm(`${tmpPath}-wal`, { force: true })
    await rm(`${tmpPath}-shm`, { force: true })

    await rename(tmpPath, this.config.dbPath)
    await rm(`${this.config.dbPath}-wal`, { force: true })
    await rm(`${this.config.dbPath}-shm`, { force: true })
  }

  /**
   * Walks the chain from the nearest full snapshot forward, applying diffs
   * until `snapshotIndex` (position in the newest-first array). Every link is
   * verified against its hash header; null means the chain is broken.
   * Snapshots older than that full one are irrelevant — self-healing can
   * leave orphaned diffs behind them.
   */
  private async reconstructText(
    snapshots: SnapshotMeta[],
    snapshotIndex: number,
  ): Promise<string | null> {
    const base = snapshots.findIndex((s, i) => i >= snapshotIndex && s.kind === 'full')
    if (base === -1) return null

    let text: string | null = null
    let previousHash: string | null = null
    for (let i = base; i >= snapshotIndex; i--) {
      const snapshot = snapshots[i]
      if (snapshot.kind === 'full') {
        text = await readSnapshotBody(snapshot.path)
      } else {
        if (text === null || snapshot.parentHash !== previousHash) return null
        const applied = applyDiff(text, await readSnapshotBody(snapshot.path))
        if (applied === null) return null
        text = applied
      }
      if (hashDump(text) !== snapshot.hash) return null
      previousHash = snapshot.hash
    }
    return text
  }

  /**
   * Retention: while over SNAPSHOTS_COUNT, fold the oldest snapshot into its
   * successor — the successor becomes the new oldest full snapshot.
   */
  private async cleanup(): Promise<void> {
    let snapshots = await listSnapshots(this.config.dir)
    while (snapshots.length > this.config.count) {
      const oldest = snapshots[snapshots.length - 1]
      const next = snapshots[snapshots.length - 2]

      if (next.kind === 'diff') {
        const merged = await this.reconstructText(snapshots, snapshots.length - 2)
        if (merged === null) {
          // An oldest snapshot nothing can reconstruct (orphaned diff, corrupt
          // full) is dead weight — drop it and retry.
          if ((await this.reconstructText(snapshots, snapshots.length - 1)) === null) {
            this.logger?.warn('dropping unreachable oldest snapshot', { file: oldest.file })
            await unlink(oldest.path)
            snapshots = await listSnapshots(this.config.dir)
            continue
          }
          this.logger?.error('cannot merge snapshots, chain is broken; keeping files', {
            file: next.file,
          })
          return
        }
        const mergedPath = join(this.config.dir, next.file.replace(/\.diff$/, '.sql'))
        const content = serializeSnapshot(
          { kind: 'full', createdAt: next.createdAt, hash: next.hash },
          merged,
        )
        await writeFile(`${mergedPath}.tmp`, content, 'utf8')
        await rename(`${mergedPath}.tmp`, mergedPath)
        await unlink(next.path)
      }
      await unlink(oldest.path)
      snapshots = await listSnapshots(this.config.dir)
    }
  }

  private async writeSnapshot(header: Omit<SnapshotHeader, 'createdAt'>, body: string) {
    const now = new Date()
    // A timestamp slot is unique across kinds so same-second snapshots never
    // share a basename (filenames have second resolution; order comes from
    // the created header).
    const slotTaken = (suffix?: number) =>
      existsSync(join(this.config.dir, snapshotFilename(now, 'full', suffix))) ||
      existsSync(join(this.config.dir, snapshotFilename(now, 'diff', suffix)))
    let slot: number | undefined = undefined
    for (let suffix = 2; slotTaken(slot); suffix++) {
      slot = suffix
    }
    const path = join(this.config.dir, snapshotFilename(now, header.kind, slot))
    const content = serializeSnapshot({ ...header, createdAt: now.toISOString() }, body)
    await writeFile(`${path}.tmp`, content, 'utf8')
    await rename(`${path}.tmp`, path)
    this.logger?.info('snapshot written', { file: path, kind: header.kind })
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
