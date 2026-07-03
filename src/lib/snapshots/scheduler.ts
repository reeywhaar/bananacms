import type { Client } from '@libsql/client'
import type { Logger } from '../logger/Logger.ts'
import type { SnapshotStore } from './store.ts'

/**
 * Debounces DB writes into snapshots: the first markDirty() after an idle
 * period arms a timer; further writes while it is pending are absorbed into
 * the same snapshot. Writes that land while a snapshot is being taken re-arm
 * the timer, so a burst yields one trailing snapshot. The timer is unref'd —
 * a snapshot pending at process exit is dropped and the next startup
 * snapshot covers it.
 */
export class SnapshotScheduler {
  private dirty = false
  private timer: NodeJS.Timeout | null = null
  private running = false

  private readonly store: SnapshotStore
  private readonly client: Client
  private readonly delayMs: number
  private readonly logger?: Logger

  constructor(store: SnapshotStore, client: Client, delayMs: number, logger?: Logger) {
    this.store = store
    this.client = client
    this.delayMs = delayMs
    this.logger = logger
  }

  markDirty(): void {
    this.dirty = true
    if (this.timer || this.running) return
    this.arm()
  }

  private arm(): void {
    this.timer = setTimeout(() => {
      this.timer = null
      void this.snapshot()
    }, this.delayMs)
    this.timer.unref()
  }

  private async snapshot(): Promise<void> {
    this.running = true
    this.dirty = false
    try {
      const result = await this.store.createSnapshot(this.client)
      this.logger?.info('scheduled snapshot', { result })
    } catch (error) {
      this.logger?.error('scheduled snapshot failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      this.running = false
      if (this.dirty) this.arm()
    }
  }
}
