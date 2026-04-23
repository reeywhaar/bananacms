export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve()
    }, ms)

    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeout)
        const err = new DOMException('Sleep aborted', 'AbortError')
        reject(err)
      })
    }
  })
