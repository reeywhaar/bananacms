import type { Metadata } from '@reeywhaar/bananacms'

// in the blog layout's folder, so its title gets the root layout's template
export const metadata: Metadata = { title: 'Index' }

export default function BlogIndex() {
  return <h1>Blog</h1>
}
