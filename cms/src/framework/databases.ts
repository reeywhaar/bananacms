import 'server-only'
import type { Client } from '@libsql/client'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import {
  createDb,
  createDerivedDb,
  openClient,
  runMigrations,
  type Db,
  type DerivedDb,
} from '../lib/db/client.ts'
import { wrapClientWithQueryLog } from '../lib/db/queryLog.ts'
import { createRootLogger } from '../lib/logger/root.ts'
import { snapshotsConfig } from '../lib/snapshots/config.ts'
import type { SnapshotScheduler } from '../lib/snapshots/scheduler.ts'
import { createSnapshotScheduler, wrapDbWithWriteHook } from '../lib/snapshots/setup.ts'
import {
  parseMigrationFileName,
  type Migration,
  type MigrationEntry,
} from '../lib/migrations/migration.ts'
import { getLogger, required, type Context } from './context.ts'

// the site's own migrations, src/lib/migrations/<id>_<name>.ts (docs/migrations.md),
// bundled with the app
const siteMigrationModules = import.meta.glob<{ default: Migration }>('/src/lib/migrations/*.ts', {
  eager: true,
})

// `snapshots` takes one a while after `onWrite` marks the main database changed,
// when SNAPSHOTS_COUNT is set (lib/snapshots)
type Clients = {
  main: Client
  derived: Client
  snapshots?: SnapshotScheduler
  onWrite?: () => void
}

// The databases, both in DATA_PATH, opened and migrated by the first request that
// needs them. A failed open is tried again by the next one, e.g. after fixing
// DATA_PATH.
//
// close() is for the shutdown, once no requests come in: it closes them, when
// they were opened, and stops the snapshots after writes, which the shutdown
// snapshot takes the place of.
export type DatabasesOpener = { open(): Promise<Clients>; close(): Promise<void> }

export function createDatabasesOpener(): DatabasesOpener {
  let clients: Promise<Clients> | undefined
  return {
    open: () =>
      (clients ??= openClients().catch((error: unknown) => {
        clients = undefined
        throw error
      })),
    async close() {
      const opened = await clients?.catch(() => undefined)
      clients = undefined
      await opened?.snapshots?.stop()
      opened?.main.close()
      opened?.derived.close()
    },
  }
}

const DATABASES = Symbol('Databases')

// the app context's databases, which requestDatabases() hands out
export function setDatabasesOpener(app: Context, open: DatabasesOpener): Context {
  return app.set(DATABASES, open)
}

// A request's drizzle handles, on the app's clients, logging its queries under the
// request's logger.
export async function requestDatabases(ctx: Context): Promise<{ db: Db; derivedDb: DerivedDb }> {
  const clients = await required<DatabasesOpener>(ctx, DATABASES).open()
  const logger = getLogger(ctx)
  const db = createDb(wrapClientWithQueryLog(clients.main, logger))
  return {
    db: clients.onWrite ? wrapDbWithWriteHook(db, clients.onWrite) : db,
    derivedDb: createDerivedDb(wrapClientWithQueryLog(clients.derived, logger)),
  }
}

async function openClients(): Promise<Clients> {
  const siteMigrations = siteMigrationEntries()
  const dataPath = process.env.DATA_PATH
  if (!dataPath) {
    throw new Error(
      'DATA_PATH is not set: point it at a directory for the databases, e.g. ./private',
    )
  }
  await mkdir(dataPath, { recursive: true })
  const main = await openClient(path.resolve(dataPath, 'database.db'))
  const derived = await openClient(path.resolve(dataPath, 'derived.db'))
  await runMigrations(main, derived, { siteMigrations })
  const snapshots = snapshotsConfig(path.resolve(dataPath))
  const scheduler =
    snapshots && createSnapshotScheduler(snapshots, main, createRootLogger().child('Snapshots'))
  return {
    main,
    derived,
    snapshots: scheduler ?? undefined,
    onWrite: scheduler ? () => scheduler.markDirty() : undefined,
  }
}

// Throws for a file with an id other than Date.now(), before any migration runs.
function siteMigrationEntries(): MigrationEntry[] {
  return Object.entries(siteMigrationModules).map(([file, module]) => ({
    ...parseMigrationFileName(file.slice(1)),
    migration: module.default,
  }))
}
