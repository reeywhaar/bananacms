import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  getSnapshotsConfig,
  snapshotsDirFor,
  type SnapshotsConfig,
} from '../lib/snapshots/config.ts'
import { listSnapshots } from '../lib/snapshots/files.ts'
import { readRunningPid } from '../lib/snapshots/pidfile.ts'
import { SnapshotStore } from '../lib/snapshots/store.ts'

export interface SnapshotCliOptions {
  action: 'list' | 'view' | 'restore'
  /** 1 = newest, counting up toward the oldest. */
  index?: number
  /** view only: print the stored file (the diff itself) instead of the reconstructed dump. */
  raw?: boolean
}

export async function run(opts: SnapshotCliOptions): Promise<void> {
  // `snapshot view 1 | head` closes the pipe early — that's fine, not a crash.
  process.stdout.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') process.exit(0)
    throw error
  })

  const dataPath = requireEnv('DATA_PATH')
  const dbPath = join(dataPath, 'database.db')
  const dir = snapshotsDirFor(dbPath)

  switch (opts.action) {
    case 'list': {
      const snapshots = await listSnapshots(dir)
      if (snapshots.length === 0) {
        console.info(`No snapshots in ${dir}`)
        return
      }
      printTable(
        ['#', 'kind', 'created', 'size', 'file'],
        snapshots.map((s, i) => [
          String(i + 1),
          s.kind,
          s.createdAt,
          formatSize(s.sizeBytes),
          s.file,
        ]),
      )
      return
    }

    case 'view': {
      const index = opts.index ?? 1
      if (opts.raw) {
        const snapshots = await listSnapshots(dir)
        const snapshot = snapshots[index - 1]
        if (!snapshot) fail(`No snapshot at index ${index} (${snapshots.length} available)`)
        process.stdout.write(await readFile(snapshot.path, 'utf8'))
        return
      }
      const store = new SnapshotStore(cliConfig(dbPath, dir, 1))
      process.stdout.write(await store.reconstruct(index))
      return
    }

    case 'restore': {
      const index = opts.index ?? 1
      const pid = readRunningPid()
      if (pid !== null) {
        fail(`bananacms app is running (pid ${pid}) — stop it before restoring`)
      }
      const snapshots = await listSnapshots(dir)
      const target = snapshots[index - 1]
      if (!target) fail(`No snapshot at index ${index} (${snapshots.length} available)`)

      // Retention for the pre-restore safety snapshot: SNAPSHOTS_COUNT when
      // set, otherwise roomy enough to never merge anything away here.
      const count = getSnapshotsConfig()?.count ?? snapshots.length + 1
      const store = new SnapshotStore(cliConfig(dbPath, dir, count))

      console.info(`Restoring ${dbPath}`)
      console.info(`  from #${index}: ${target.file} (created ${target.createdAt})`)
      console.info('  snapshotting the current state first...')
      await store.restore(index)
      console.info('Done.')
      return
    }
  }
}

const cliConfig = (dbPath: string, dir: string, count: number): SnapshotsConfig => ({
  count,
  delayMs: 0,
  dir,
  dbPath,
})

function printTable(header: string[], rows: string[][]): void {
  const table = [header, ...rows]
  const widths = header.map((_, col) => Math.max(...table.map((row) => row[col].length)))
  for (const row of table) {
    console.info(
      row
        .map((cell, col) => cell.padEnd(widths[col]))
        .join('  ')
        .trimEnd(),
    )
  }
}

const formatSize = (bytes: number): string => {
  let value = bytes
  for (const unit of ['B', 'KB', 'MB']) {
    if (value < 1024) return `${unit === 'B' ? String(value) : value.toFixed(1)} ${unit}`
    value /= 1024
  }
  return `${value.toFixed(1)} GB`
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`${name} is not set. Provide it via .env or the environment.`)
    process.exit(1)
  }
  return v
}
