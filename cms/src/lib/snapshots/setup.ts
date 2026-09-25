import { existsSync } from 'node:fs'
import { createClient, type Client } from '@libsql/client'
import type { Logger } from '../logger/Logger.ts'
import type { SnapshotsConfig } from './config.ts'
import { SnapshotScheduler } from './scheduler.ts'
import { SnapshotStore } from './store.ts'

// A snapshot taken on a connection of its own, as the site starts and as it shuts
// down: at shutdown, it holds the writes a scheduled snapshot was still waiting
// out its delay for. Nothing is written when the database hasn't changed since the
// newest snapshot.
export async function takeSnapshot(
  config: SnapshotsConfig,
  logger: Logger,
  reason: 'startup' | 'shutdown',
): Promise<void> {
  if (!existsSync(config.dbPath)) return
  const client = createClient({ url: `file:${config.dbPath}` })
  try {
    const result = await new SnapshotStore(config, logger).createSnapshot(client)
    logger.info(`${reason} snapshot`, { result })
  } finally {
    client.close()
  }
}

// The scheduler for the app's database, on its own client, which the site's
// writes mark dirty (wrapDbWithWriteHook)
export function createSnapshotScheduler(
  config: SnapshotsConfig,
  client: Client,
  logger: Logger,
): SnapshotScheduler {
  return new SnapshotScheduler(new SnapshotStore(config, logger), client, config.delayMs, logger)
}

const WRITE_METHODS = new Set(['insert', 'update', 'delete', 'run', 'batch', 'transaction'])

// Calls `onWrite` whenever one of drizzle's methods that can write is used. That
// takes in some reads too, through `run` and `transaction`, and the snapshot they
// cause finds the database unchanged, while a write left out would be missing
// from the snapshots.
export function wrapDbWithWriteHook<T extends object>(db: T, onWrite: () => void): T {
  return new Proxy(db, {
    get(target, prop) {
      if (typeof prop === 'string' && WRITE_METHODS.has(prop)) onWrite()
      const value = Reflect.get(target, prop) as unknown
      // bound to the target, not the proxy: drizzle needs its own instance as `this`
      if (typeof value === 'function') return value.bind(target)
      return value
    },
  })
}
