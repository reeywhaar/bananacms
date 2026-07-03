import { existsSync } from 'node:fs'
import { createClient, type Client } from '@libsql/client'
import { createRootLogger } from '../logger/root.ts'
import { globalSetup } from '../../utils/globalSetup.ts'
import { getSnapshotsConfig } from './config.ts'
import { SnapshotScheduler } from './scheduler.ts'
import { SnapshotStore } from './store.ts'

/**
 * Snapshot taken at app boot (from instrumentation.ts). Both Next zones run
 * it; the store's lock file plus hash dedupe make the second one a no-op.
 */
export async function runStartupSnapshot(): Promise<void> {
  const config = getSnapshotsConfig()
  if (!config) return
  if (!existsSync(config.dbPath)) return

  const logger = createRootLogger().child('snapshots')
  const client = createClient({ url: `file:${config.dbPath}` })
  try {
    const store = new SnapshotStore(config, logger)
    const result = await store.createSnapshot(client)
    logger.info('startup snapshot', { result })
  } finally {
    client.close()
  }
}

/**
 * Process-wide scheduler that watches the given (already-open) client's
 * database. null when snapshotting is disabled. globalSetup keys the instance
 * on globalThis, so every request and duplicated module graph share one timer.
 */
export function setupSnapshotScheduler(client: Client): SnapshotScheduler | null {
  const holder = globalSetup('cms.snapshots.scheduler', () => {
    const config = getSnapshotsConfig()
    if (!config) return { scheduler: null }
    const logger = createRootLogger().child('snapshots')
    const store = new SnapshotStore(config, logger)
    return { scheduler: new SnapshotScheduler(store, client, config.delayMs, logger) }
  })
  return holder.scheduler
}

const WRITE_METHODS = new Set(['insert', 'update', 'delete', 'run', 'batch', 'transaction'])

/**
 * Marks the database dirty whenever a write-capable drizzle method is
 * accessed. Over-approximates (`run`/`transaction` may be reads) — a spurious
 * snapshot attempt is deduped by hash, while a missed write would be lost.
 */
export function wrapDbWithWriteHook<T extends object>(db: T, onWrite: () => void): T {
  return new Proxy(db, {
    get(target, prop) {
      if (typeof prop === 'string' && WRITE_METHODS.has(prop)) onWrite()
      const value = Reflect.get(target, prop) as unknown
      // Bind to the target, not the proxy: drizzle internals must see the
      // real instance as `this`.
      if (typeof value === 'function') return value.bind(target)
      return value
    },
  })
}
