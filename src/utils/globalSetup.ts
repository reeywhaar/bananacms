export const globalSetup = <T>(label: string, factory: () => T) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gb = globalThis as any
  if (!gb[label]) {
    gb[label] = factory()
  }
  return gb[label] as T
}

/**
 * Per-request memoization keyed on an object that lives exactly as long as
 * the request (callers pass the `headers()` object), so entries are released
 * by GC with the request — no manual cleanup, no growth with request count.
 * The WeakMap itself lives on globalThis so duplicated dev module graphs
 * share one map.
 */
export const requestSetup = <T>(key: object, label: string, factory: () => T): T => {
  const contexts = globalSetup(
    'cms.requestContexts',
    () => new WeakMap<object, Record<string, unknown>>(),
  )
  let ctx = contexts.get(key)
  if (!ctx) {
    ctx = {}
    contexts.set(key, ctx)
  }
  if (!ctx[label]) {
    ctx[label] = factory()
  }
  return ctx[label] as T
}
