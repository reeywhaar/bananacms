import { getUrl, type LayoutProps, type Metadata } from '@reeywhaar/bananacms'

export const metadata: Metadata = {
  title: { template: '%s | Fixture', default: 'Fixture' },
  description: 'Root',
}

export default function RootLayout({ ctx, children }: LayoutProps) {
  if (getUrl(ctx).searchParams.has('break-layout')) throw new Error('Expected: the layout broke')
  return (
    <html lang="en">
      <body>
        <header>Fixture site</header>
        {children}
      </body>
    </html>
  )
}
