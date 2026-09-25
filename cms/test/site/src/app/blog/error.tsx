'use client'

import type { ErrorPageProps } from '@reeywhaar/bananacms/client'

export default function BlogError({ error }: ErrorPageProps) {
  return (
    <>
      <h1>The blog broke</h1>
      <p id="message">{error.message}</p>
    </>
  )
}
