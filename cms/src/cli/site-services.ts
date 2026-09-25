import { existsSync, rmSync } from 'node:fs'
import { constants } from 'node:os'
import path from 'node:path'
import { createClient } from '@libsql/client'
import { backupConfig } from '../lib/backup/config.ts'
import { BackupPusher } from '../lib/backup/pusher.ts'
import type { Logger } from '../lib/logger/Logger.ts'
import { createRootLogger } from '../lib/logger/root.ts'
import { snapshotsConfig } from '../lib/snapshots/config.ts'
import { readRunningPid, removePidFile, writePidFile } from '../lib/snapshots/pidfile.ts'
import { takeSnapshot } from '../lib/snapshots/setup.ts'
import { dataPath } from './site-databases.ts'

// What `dev` and `start` can't run without, and what each is
const REQUIRED_ENV: Record<string, string> = {
  DATA_PATH: 'the directory for the databases, like ./private',
  ASSETS_DIRECTORY: 'the directory for the uploads and their image variants, like ./private/assets',
}

// Fails, naming each one, unless the variables `dev` and `start` need are set
export function checkServerEnv(): void {
  const missing = Object.entries(REQUIRED_ENV).filter(([name]) => !process.env[name])
  if (missing.length === 0) return
  throw new Error(
    `Set ${missing.map(([name, what]) => `${name}, ${what}`).join(', and ')}, in the site's .env or the environment`,
  )
}

export type SiteServices = {
  // for the shutdown, once the server and the app's databases are closed
  stop(): Promise<void>
}

// What `dev` and `start` run around the server: the .pid file, which `snapshot
// restore` checks, a snapshot as the site starts and as it stops, when
// SNAPSHOTS_COUNT is set, and the loop that backs the databases up to BACKUP_URL,
// when it's set, with a last pass as the site stops. The app takes the snapshots
// after writes itself (framework/databases.ts).
export async function startSiteServices(root: string): Promise<SiteServices> {
  const other = readRunningPid(root)
  if (other !== null && other !== process.pid) {
    console.warn(
      `bananacms: another server of this site is running (pid ${other}); the .pid file is this one's now`,
    )
  }
  writePidFile(root)
  process.on('exit', () => removePidFile(root))

  const dir = dataPath(root)
  const logger = createRootLogger()

  const snapshots = snapshotsConfig(dir)
  const snapshot = async (reason: 'startup' | 'shutdown') => {
    // a failed snapshot keeps the site from neither starting nor stopping
    await takeSnapshot(snapshots!, logger.child('Snapshots'), reason).catch((error: unknown) => {
      logger.child('Snapshots').error(`${reason} snapshot failed`, errorFields(error))
    })
  }
  if (snapshots) await snapshot('startup')

  const backups = backupConfig(dir)
  const backup = backups && new BackupPusher({ config: backups, logger: logger.child('Backup') })
  backup?.start()

  return {
    async stop() {
      if (snapshots) await snapshot('shutdown')
      // ahead of the checkpoint: VACUUM INTO opens a connection of its own, which
      // makes the -wal files again
      if (backup) {
        await backup.runOnce().catch((error: unknown) => {
          logger.child('Backup').error('last backup failed', errorFields(error))
        })
        await backup.stop()
      }
      await checkpoint(dir, logger)
      removePidFile(root)
    },
  }
}

// Folds each database's -wal file into it, and removes the -wal and -shm files
// once they're empty, so that while the site is down its .db files hold all of
// its data, and a copy of the directory misses nothing. SQLite takes them back from
// the -wal when the site starts in any case.
async function checkpoint(dir: string, logger: Logger): Promise<void> {
  for (const name of ['database.db', 'derived.db']) {
    const file = path.join(dir, name)
    if (!existsSync(file)) continue
    try {
      const client = createClient({ url: `file:${file}` })
      let folded = false
      try {
        const row = (await client.execute('PRAGMA wal_checkpoint(TRUNCATE)')).rows[0]
        // busy: another connection kept it from finishing; log: pages left in
        // the -wal
        folded = Number(row?.busy) === 0 && Number(row?.log) === 0
      } finally {
        client.close()
      }
      // libsql's close leaves them there, empty
      if (folded) {
        rmSync(`${file}-wal`, { force: true })
        rmSync(`${file}-shm`, { force: true })
      }
    } catch (error) {
      // the data is safe in the -wal, so a failure here is no failed shutdown
      logger.warn('checkpoint failed', { file, ...errorFields(error) })
    }
  }
}

// Says how to make the site's first user, while it has none: nobody can sign in
// to /manage before `user create` has made one
export async function printUsersHint(root: string): Promise<void> {
  const file = path.join(dataPath(root), 'database.db')
  if (existsSync(file)) {
    const client = createClient({ url: `file:${file}` })
    try {
      const { rows } = await client.execute('SELECT count(*) AS count FROM user')
      if (Number(rows[0]?.count) > 0) return
    } catch {
      // a database the migrations haven't made yet has no users either
    } finally {
      client.close()
    }
  }
  console.info(
    'bananacms: the site has no users yet: `bananacms user create <name>` prints a link where one sets a password',
  )
}

// Shuts the site down on SIGINT or SIGTERM, once, with `shutdown`, then exits. A
// second signal exits right away.
export function shutDownOnSignals(shutdown: () => Promise<void>): void {
  let shuttingDown = false
  const onSignal = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      console.warn(`bananacms: ${signal} again, exiting now`)
      process.exit(128 + constants.signals[signal])
    }
    shuttingDown = true
    console.info(`\nbananacms: ${signal}, shutting down...`)
    shutdown().then(
      () => process.exit(0),
      (error: unknown) => {
        console.error(`bananacms: the shutdown failed: ${errorFields(error).error}`)
        process.exit(1)
      },
    )
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)
}

function errorFields(error: unknown): { error: string } {
  return { error: error instanceof Error ? error.message : String(error) }
}
