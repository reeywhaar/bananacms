import type { LayoutProps, Metadata } from '@reeywhaar/bananacms'

// a second root layout, with <html> of its own
export const metadata: Metadata = { title: 'Showcase' }

export default function ShowcaseLayout({ children }: LayoutProps) {
  return (
    <html lang="en">
      <body>
        <header>Showcase</header>
        {children}
      </body>
    </html>
  )
}
