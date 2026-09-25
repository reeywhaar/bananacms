import type { Metadata } from '@reeywhaar/bananacms'

// in the root layout's folder, so the layout's template leaves its title alone
export const metadata: Metadata = { title: 'Home' }

export default function HomePage() {
  return (
    <>
      <h1>Home</h1>
      <a href="/api/hello">A route handler</a>
    </>
  )
}
