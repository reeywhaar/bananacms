import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import './globals.css' // css import is automatically injected in exported server components
import type { ReactNode } from 'react'
import { CMSLocalesProvider } from '../../components/CMSLocalesProvider/CMSLocalesProvider.tsx'
import { ProgressOverlayProvider } from '../../components/ProgressOverlay/ProgressOverlay.tsx'
import { ToastProvider } from '../../components/Toast/Toast.tsx'
import { TopLoader } from '../../components/TopLoader/TopLoader.tsx'
import type { Context } from '../../framework/context.ts'
import { getSiteConfig } from '../../framework/site-config.ts'
import { AdminBar } from './AdminBar/AdminBar.tsx'
import { BreadcrumbsProvider } from './BreadCrumbs/Breadcrumbs.tsx'
import { getAuth } from '../../framework/context.ts'

export default function ManageLayout({ ctx, children }: { ctx: Context; children: ReactNode }) {
  const { locales } = getSiteConfig()

  return (
    <CMSLocalesProvider locales={locales}>
      <BreadcrumbsProvider>
        <html lang="en">
          <head>
            <meta charSet="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Manage</title>
          </head>
          <body>
            <TopLoader color="#3b82f6" />
            <ProgressOverlayProvider>
              <ToastProvider>
                <AdminBar user={getAuth(ctx)?.user} />
                {children}
              </ToastProvider>
            </ProgressOverlayProvider>
          </body>
        </html>
      </BreadcrumbsProvider>
    </CMSLocalesProvider>
  )
}
