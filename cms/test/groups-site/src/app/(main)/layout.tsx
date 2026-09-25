import type { LayoutProps, Metadata } from '@reeywhaar/bananacms'

// the root layout for the pages in (main), as a site's main layout often is
export const metadata: Metadata = { title: { template: '%s | Groups', default: 'Groups' } }

export default function MainLayout({ children }: LayoutProps) {
  return (
    <html lang="en">
      <body>
        <header>Main</header>
        {children}
      </body>
    </html>
  )
}
