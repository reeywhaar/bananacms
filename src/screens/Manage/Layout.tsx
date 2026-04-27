import './globals.css'
import { ReactNode } from 'react'
import { ApiDispatcherProvider } from '@cms/components/ApiDispatcherProvider/ApiDispatcherProvider'
import { CMSLocalesProvider } from '@cms/components/CMSLocalesProvider/CMSLocalesProvider'
import { getCMS } from '@cms/config'
import { getServices } from '@cms/services/getServices'
import { Roboto } from 'next/font/google'
import { BreadcrumbsProvider } from './BreadCrumbs/Breadcrumbs'
import { AdminBar } from './AdminBar/AdminBar'
import { ProgressOverlayProvider } from '@cms/components/ProgressOverlay/ProgressOverlay'
import { ToastProvider } from '@cms/components/Toast/Toast'
import { Metadata } from 'next'

const mainFont = Roboto({
  subsets: ['latin', 'cyrillic-ext'],
  weight: ['300', '400', '500', '700'],
})

export const metadata: Metadata = {
  // Read at request time per page; undefined at package-build time when the
  // env var isn't set yet. Falling back to undefined makes Next.js use
  // relative URLs in metadata, which is acceptable for the admin UI.
  metadataBase: process.env.NEXT_PUBLIC_SERVER_URL
    ? new URL(process.env.NEXT_PUBLIC_SERVER_URL)
    : undefined,
  title: {
    template: 'Manage | %s',
    default: 'Manage',
  },
}

export default async function ManageLayout({ children }: { children: ReactNode }) {
  const req = await getServices()
  const { locales } = getCMS()

  return (
    <ApiDispatcherProvider traceId={req.traceId}>
      <CMSLocalesProvider locales={locales}>
        <BreadcrumbsProvider>
          <html lang="en">
            <body className={mainFont.className}>
              <ProgressOverlayProvider>
                <ToastProvider>
                  <AdminBar user={req.authData.user} />
                  {children}
                </ToastProvider>
              </ProgressOverlayProvider>
            </body>
          </html>
        </BreadcrumbsProvider>
      </CMSLocalesProvider>
    </ApiDispatcherProvider>
  )
}
