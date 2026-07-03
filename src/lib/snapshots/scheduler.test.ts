import type { Client } from '@libsql/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SnapshotScheduler } from './scheduler'
import type { SnapshotStore } from './store'

const clientStub = {} as Client

afterEach(() => {
  vi.useRealTimers()
})

describe('SnapshotScheduler', () => {
  it('coalesces a burst of writes into one trailing snapshot', async () => {
    vi.useFakeTimers()
    const createSnapshot = vi.fn().mockResolvedValue('created')
    const store = { createSnapshot } as unknown as SnapshotStore
    const scheduler = new SnapshotScheduler(store, clientStub, 1000)

    scheduler.markDirty()
    scheduler.markDirty()
    scheduler.markDirty()

    await vi.advanceTimersByTimeAsync(999)
    expect(createSnapshot).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(createSnapshot).toHaveBeenCalledTimes(1)

    // Idle afterwards: no re-arm without new writes.
    await vi.advanceTimersByTimeAsync(10_000)
    expect(createSnapshot).toHaveBeenCalledTimes(1)
  })

  it('re-arms when a write lands during an in-flight snapshot', async () => {
    vi.useFakeTimers()
    let finishFirst!: (value: string) => void
    const createSnapshot = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)))
      .mockResolvedValue('created')
    const store = { createSnapshot } as unknown as SnapshotStore
    const scheduler = new SnapshotScheduler(store, clientStub, 1000)

    scheduler.markDirty()
    await vi.advanceTimersByTimeAsync(1000)
    expect(createSnapshot).toHaveBeenCalledTimes(1)

    scheduler.markDirty() // lands while the first snapshot is still running
    finishFirst('created')
    await vi.advanceTimersByTimeAsync(1000)
    expect(createSnapshot).toHaveBeenCalledTimes(2)
  })

  it('does not snapshot without writes', async () => {
    vi.useFakeTimers()
    const createSnapshot = vi.fn().mockResolvedValue('created')
    const store = { createSnapshot } as unknown as SnapshotStore
    new SnapshotScheduler(store, clientStub, 1000)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(createSnapshot).not.toHaveBeenCalled()
  })
})
