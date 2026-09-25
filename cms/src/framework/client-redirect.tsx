'use client'

import { useEffect } from 'react'
import { useRouter } from './navigation.ts'

// Renders in place of a page that called redirect() after its response started,
// such as on client-side navigation. It navigates once it mounts, and a browser
// with JavaScript off follows the refresh.
export function ClientRedirect(props: { url: string }) {
  const router = useRouter()
  useEffect(() => router.replace(props.url), [router, props.url])
  return (
    <noscript>
      <meta httpEquiv="refresh" content={`0; url=${props.url}`} />
    </noscript>
  )
}
