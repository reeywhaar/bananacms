const REQ_SYMBOL = 'C6AF8358-DFC4-4D4C-A24A-1EE233C57A02-context'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getRequestContext = (sessionId: string): Record<string, any> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gb = globalThis as any
  if (!gb[REQ_SYMBOL]) {
    gb[REQ_SYMBOL] = {}
  }
  if (!gb[REQ_SYMBOL][sessionId]) {
    gb[REQ_SYMBOL][sessionId] = {}
  }
  return gb[REQ_SYMBOL][sessionId]
}

export const clearRequestContext = (sessionId: string): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gb = globalThis as any
  if (gb[REQ_SYMBOL]) {
    delete gb[REQ_SYMBOL][sessionId]
  }
}
