import { describe, expect, it } from 'vitest'
import { Semaphore } from './semaphore'

describe('Semaphore', () => {
  it('never runs more than `size` jobs at once', async () => {
    const semaphore = new Semaphore(2)
    let running = 0
    let peak = 0
    const job = () =>
      semaphore.run(async () => {
        running++
        peak = Math.max(peak, running)
        await new Promise((resolve) => setTimeout(resolve, 10))
        running--
      })
    await Promise.all(Array.from({ length: 8 }, job))
    expect(peak).toBe(2)
    expect(running).toBe(0)
  })

  it('returns the work result and releases the slot on failure', async () => {
    const semaphore = new Semaphore(1)
    await expect(semaphore.run(async () => 42)).resolves.toBe(42)
    await expect(
      semaphore.run(async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    // The failed run must have released its slot for the next job.
    await expect(semaphore.run(async () => 'after')).resolves.toBe('after')
  })

  it('wakes queued jobs in FIFO order', async () => {
    const semaphore = new Semaphore(1)
    const order: number[] = []
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        semaphore.run(async () => {
          order.push(i)
          await new Promise((resolve) => setTimeout(resolve, 1))
        }),
      ),
    )
    expect(order).toEqual([0, 1, 2, 3, 4])
  })
})
