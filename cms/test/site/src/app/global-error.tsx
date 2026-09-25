'use client'

import type { ErrorPageProps } from '@reeywhaar/bananacms/client'

export default function GlobalError({ error }: ErrorPageProps) {
  return (
    <html lang="en">
      <body>
        <h1>The whole site broke</h1>
        <p id="message">{error.message}</p>
      </body>
    </html>
  )
}
