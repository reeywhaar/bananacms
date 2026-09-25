import type { LayoutProps, Metadata } from '@reeywhaar/bananacms'

export const metadata: Metadata = {
  title: { template: '%s | Blog | Fixture', default: 'Blog' },
}

export default function BlogLayout({ children }: LayoutProps) {
  return <section>{children}</section>
}
