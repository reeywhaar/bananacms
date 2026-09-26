import type { Metadata } from '@reeywhaar/bananacms'
import { lazy, Suspense } from 'react'

export const metadata: Metadata = { title: 'Imports' }

// a client component, as a server component loads it with React.lazy
const LazyCounter = lazy(() => import('../../components/LazyCounter.tsx'))

export default async function ImportsPage() {
  // a server component, which the page imports as it renders
  const { Imported } = await import('../../components/Imported.tsx')
  return (
    <>
      <Suspense fallback={<p>Loading the counter</p>}>
        <LazyCounter />
      </Suspense>
      <Imported name="the page" />
    </>
  )
}
