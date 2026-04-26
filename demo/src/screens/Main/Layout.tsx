'use server'

import './globals.css'

import { ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import SideMenu from '@app/components/SideMenu/SideMenu'
import { SideMenuProvider } from '@app/components/SideMenu/SideMenuContext'
import { LangContextProvider } from '@app/contexts/LangContext'
import { mainFont } from '@app/lib/fonts'
import { Breadcrumbs, BreadcrumbsProvider } from '@app/components/Breadcrumbs/Breadcrumbs'
import { getLangContext } from '@app/lib/getLangContext'
import { getServices } from '@reeywhaar/bananacms/runtime'
import { BlockStore, CategoryStore } from '@reeywhaar/bananacms/stores'
import { routing } from './routing'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { findAndMap } from '@app/utils/findAndMap'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('main')

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SERVER_URL!),
    title: {
      template: '%s | ' + t('name'),
      default: t('name'),
    },
  }
}

export default async function Layout({ children }: { children: ReactNode }) {
  const langContext = await getLangContext()
  const services = await getServices()
  const categoryStore = new CategoryStore(services.db)
  const blockStore = new BlockStore(services.db)
  const categories = await Promise.all(
    (await categoryStore.get({ type: 'all' }, { locale: langContext.currentLocale })).map(async (c) => {
      const blocks = (
        await blockStore.getPublicByParentIds(langContext.currentLocale, 'category', [c.id])
      )[c.id]
      const description = findAndMap(blocks, (b) =>
        b.content.type === 'text' ? { data: b.content.text } : null,
      )
      return {
        ...c,
        description: description || '',
        url: routing.category(c.shortid, c.slug),
      }
    }),
  )

  return (
    <LangContextProvider value={langContext}>
      <NextIntlClientProvider>
        <BreadcrumbsProvider>
          <html lang={langContext.currentLocale}>
            <body className={mainFont.className}>
              <SideMenuProvider>
                <div className="sticky top-0 z-10 px-2 md:px-4 bg-white">
                  <div className="flex flex-row items-center justify-space-between h-8">
                    <Breadcrumbs />
                    <div className="flex-1" />
                    <SideMenu sections={categories} loggedIn={services.authData.loggedIn} />
                  </div>
                  <hr className="w-full border-t border-gray-200" />
                </div>
                {children}
              </SideMenuProvider>
            </body>
          </html>
        </BreadcrumbsProvider>
      </NextIntlClientProvider>
    </LangContextProvider>
  )
}
