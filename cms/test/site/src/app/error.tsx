'use client'

import type { ErrorPageProps } from '@reeywhaar/bananacms/client'

export default function ErrorPage({ error, reset, unstable_retry }: ErrorPageProps) {
  return (
    <main>
      <h1>Something broke</h1>
      <p id="message">{error.message}</p>
      <p id="digest">{error.digest}</p>
      <button onClick={reset}>Reset</button>
      <button onClick={unstable_retry}>Retry</button>
    </main>
  )
}
