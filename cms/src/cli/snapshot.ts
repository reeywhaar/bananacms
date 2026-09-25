import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { backupConfig } from '../lib/backup/config.ts'
import { BackupPusher } from '../lib/backup/pusher.ts'
import { createRootLogger } from '../lib/logger/root.ts'
import { snapshotsConfig, snapshotsDirFor, type SnapshotsConfig } from '../lib/snapshots/config.ts'
import { listSnapshots } from '../lib/snapshots/files.ts'
import { readRunningPid } from '../lib/snapshots/pidfile.ts'
import { SnapshotStore } from '../lib/snapshots/store.ts'
import { dataPath } from './site-databases.ts'

// The `snapshot` and `backup` commands. Snapshots are in DATA_PATH/snapshots,
// numbered from 1, the newest.

export async function listSnapshotsCommand(root: string): Promise<void> {
  const dir = snapshotsDirFor(databasePath(root))
  const snapshots = await listSnapshots(dir)
  if (snapshots.length === 0) {
    console.info(`No snapshots in ${dir}`)
    return
  }
  printTable(
    ['#', 'kind', 'created', 'size', 'file'],
    snapshots.map((snapshot, i) => [
      String(i + 1),
      snapshot.kind,
      snapshot.createdAt,
      formatSize(snapshot.sizeBytes),
      snapshot.file,
    ]),
  )
}

// Prints snapshot `index` as the SQL that makes the database, or with `raw`, as
// its file has it: a diff for all but the oldest.
export async function viewSnapshot(
  root: string,
  index: number,
  options: { raw?: boolean } = {},
): Promise<void> {
  // `snapshot view 1 | head` closes the pipe early, and that's no failure
  process.stdout.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') process.exit(0)
    throw error
  })
  const dbPath = databasePath(root)
  if (options.raw) {
    const snapshots = await listSnapshots(snapshotsDirFor(dbPath))
    const snapshot = snapshots[index - 1]
    if (!snapshot) throw new Error(`No snapshot ${index}: there are ${snapshots.length}`)
    process.stdout.write(await readFile(snapshot.path, 'utf8'))
    return
  }
  process.stdout.write(await new SnapshotStore(cliConfig(dbPath, 1)).reconstruct(index))
}

// Replaces database.db with snapshot `index`, once the site has stopped. The
// current database is snapshotted first, so the restore can be undone.
export async function restoreSnapshot(root: string, index: number): Promise<void> {
  const pid = readRunningPid(root)
  if (pid !== null) {
    throw new Error(`The site is running (pid ${pid}): stop it before restoring a snapshot`)
  }
  const dbPath = databasePath(root)
  const snapshots = await listSnapshots(snapshotsDirFor(dbPath))
  const target = snapshots[index - 1]
  if (!target) throw new Error(`No snapshot ${index}: there are ${snapshots.length}`)
  // keeps SNAPSHOTS_COUNT for the snapshot of the current state, or else room
  // enough to merge nothing away for it
  const count = snapshotsConfig(path.dirname(dbPath))?.count ?? snapshots.length + 1
  console.info(`Restoring ${dbPath}`)
  console.info(`  from ${index}: ${target.file}, of ${target.createdAt}`)
  console.info('  snapshotting the current database first...')
  await new SnapshotStore(cliConfig(dbPath, count)).restore(index)
  console.info('bananacms: restored')
}

// Backs the databases up to BACKUP_URL now, whether or not anything changed. It
// can run while the site does.
export async function backupNow(root: string): Promise<void> {
  const config = backupConfig(dataPath(root))
  if (!config) {
    throw new Error(
      'BACKUP_URL is not set: point it at a backup agent that takes archives at POST /',
    )
  }
  console.info(`Backing up to ${config.url} (mode: ${config.mode})`)
  const backup = new BackupPusher({ config, logger: createRootLogger().child('Backup') })
  try {
    // the database is read, and the counter of writes left aside
    const result = await backup.runOnce({ force: true })
    if (result === 'unchanged') console.info('The agent has this database already: nothing sent.')
    if (result === 'not-ready') throw new Error(`No database at ${config.dbPath} to back up yet`)
  } finally {
    await backup.stop()
  }
}

function databasePath(root: string): string {
  return path.join(dataPath(root), 'database.db')
}

const cliConfig = (dbPath: string, count: number): SnapshotsConfig => ({
  count,
  delayMs: 0,
  dir: snapshotsDirFor(dbPath),
  dbPath,
})

function printTable(header: string[], rows: string[][]): void {
  const table = [header, ...rows]
  const widths = header.map((_, column) => Math.max(...table.map((row) => row[column].length)))
  for (const row of table) {
    console.info(
      row
        .map((cell, column) => cell.padEnd(widths[column]))
        .join('  ')
        .trimEnd(),
    )
  }
}

function formatSize(bytes: number): string {
  let value = bytes
  for (const unit of ['B', 'KB', 'MB']) {
    if (value < 1024) return `${unit === 'B' ? String(value) : value.toFixed(1)} ${unit}`
    value /= 1024
  }
  return `${value.toFixed(1)} GB`
}
