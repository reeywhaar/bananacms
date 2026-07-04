import { globalSetup } from './globalSetup'

/**
 * Deduplicate concurrent async work by key: while a call for `key` is in
 * flight, later callers receive the same promise instead of starting the
 * work again. Entries are removed once the work settles — results are not
 * cached, only concurrency is collapsed. The map lives on globalThis so
 * duplicated dev module graphs share it.
 */
export function singleflight<T>(key: string, work: () => Promise<T>): Promise<T> {
  const inflight = globalSetup('cms.singleflight', () => new Map<string, Promise<unknown>>())
  const existing = inflight.get(key)
  if (existing) return existing as Promise<T>
  const promise = work().finally(() => {
    inflight.delete(key)
  })
  inflight.set(key, promise)
  return promise
}
