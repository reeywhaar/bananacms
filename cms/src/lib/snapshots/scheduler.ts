import type { Client } from '@libsql/client'
import type { Logger } from '../logger/Logger.ts'
import type { SnapshotStore } from './store.ts'

/**
 * Debounces DB writes into snapshots: the first markDirty() after an idle
 * period arms a timer; further writes while it is pending are absorbed into
 * the same snapshot. Writes that land while a snapshot is being taken re-arm
 * the timer, so a burst yields one trailing snapshot. The timer is unref'd, and
 * stop() drops a snapshot still waiting: the shutdown snapshot takes in its
 * writes.
 */
export class SnapshotScheduler {
  private dirty = false
  private timer: NodeJS.Timeout | null = null
  private running = false
  private stopped = false
  private current: Promise<void> | null = null

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
    if (this.timer || this.running || this.stopped) return
    this.arm()
  }

  // Stops arming snapshots, once one being taken has finished
  async stop(): Promise<void> {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    await this.current
  }

  private arm(): void {
    this.timer = setTimeout(() => {
      this.timer = null
      this.current = this.snapshot()
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
      if (this.dirty && !this.stopped) this.arm()
    }
  }
}
