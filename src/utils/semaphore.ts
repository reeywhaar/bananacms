import { availableParallelism } from 'node:os'
import { globalSetup } from './globalSetup'

/**
 * Counting semaphore with a FIFO queue: at most `size` `run()` callbacks are
 * in flight at once; the rest wait their turn.
 */
export class Semaphore {
  private available: number
  private readonly queue: (() => void)[] = []

  constructor(readonly size: number) {
    this.available = size
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await work()
    } finally {
      this.release()
    }
  }

  private acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--
      return Promise.resolve()
    }
    return new Promise((resolve) => this.queue.push(resolve))
  }

  private release(): void {
    const next = this.queue.shift()
    if (next) {
      next()
    } else {
      this.available++
    }
  }
}

/**
 * Global gate for CPU-heavy image encodes. sharp runs each operation on the
 * libuv threadpool (4 slots by default, independent of core count), so
 * without a gate a burst of cold variants runs several encodes at once and
 * starves the event loop — on a 1-CPU host that stalls every SSR in flight.
 * Cap at cores - 1 to keep one core for the event loop; the singleflight in
 * the variant route already dedupes same-variant requests above this. Lives
 * on globalThis so duplicated dev module graphs share one gate.
 */
export const imageEncodeSemaphore = (): Semaphore =>
  globalSetup(
    'cms.imageEncodeSemaphore',
    () => new Semaphore(Math.max(1, availableParallelism() - 1)),
  )
