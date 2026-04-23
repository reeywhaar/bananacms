import { getRequestContext } from '@cms/services/requestContext'

export const globalSetup = <T>(label: string, factory: () => T) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gb = globalThis as any
  if (!gb[label]) {
    gb[label] = factory()
  }
  return gb[label] as T
}

export const requestSetup = <T>(sessionId: string, label: string, factory: () => T) => {
  const ctx = getRequestContext(sessionId)
  if (!ctx[label]) {
    ctx[label] = factory()
  }
  return ctx[label] as T
}
