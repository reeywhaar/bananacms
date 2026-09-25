// the font's files are self-hosted, served from the site like its other assets
import '@fontsource-variable/noto-sans-display/wdth.css'
import '../../index.css' // css import is automatically injected in exported server components
import {
  getDb,
  getUrl,
  type LayoutProps,
  type Metadata,
  type SegmentProps,
} from '@reeywhaar/bananacms'
import { Link } from '@reeywhaar/bananacms/client'
import { CategoryStore } from '@reeywhaar/bananacms/stores'
import { LanguageSwitch } from '@app/components/LanguageSwitch.tsx'
import { NavLinks } from '@app/components/NavLinks.tsx'
import { PendingIndicator } from '@app/components/PendingIndicator.tsx'
import { languageNames, t } from '@app/lib/i18n.ts'
import { defaultLocale, isLocale, locales } from '@app/lib/locale.ts'

// The pages below it get the title template, and the home page, in the layout's
// own folder, the default title
export async function generateMetadata(props: SegmentProps<{ locale: string }>): Promise<Metadata> {
  const { locale } = await props.params
  return {
    title: { template: '%s · bananacms', default: 'bananacms demo' },
    description: t(isLocale(locale) ? locale : defaultLocale).description,
    metadataBase: new URL(getUrl(props.ctx).origin),
    icons:
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍌</text></svg>",
  }
}

// Every page's root layout, in the language its URL starts with: the categories,
// the search and the languages in the header, and the credits in the footer. A
// URL that starts with no language gets the default's, and the not-found page.
export default async function LocaleLayout(props: LayoutProps<{ locale: string }>) {
  const { locale: param } = await props.params
  const locale = isLocale(param) ? param : defaultLocale
  const strings = t(locale)
  const categories = await new CategoryStore(getDb(props.ctx))
    .query()
    .locale(locale)
    .orderBy('slug', 'desc')
    .all()

  return (
    <html lang={locale}>
      <body>
        <PendingIndicator />
        <header className="border-b border-amber-200 bg-white/70">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href={`/${locale}`} className="mr-auto font-bold font-stretch-semi-condensed">
              🍌 bananacms
            </Link>
            <NavLinks
              links={[
                ...categories.map((category) => ({
                  href: `/${locale}/${category.slug}`,
                  label: category.name,
                })),
                { href: `/${locale}/search`, label: strings.search },
              ]}
            />
            <LanguageSwitch
              locale={locale}
              languages={locales.map((code) => [code, languageNames[code] ?? code])}
            />
            <a
              href="/manage"
              className="rounded-lg border border-amber-300 px-2.5 py-1 text-sm text-stone-600 hover:bg-amber-100"
            >
              {strings.manage}
            </a>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">{props.children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 text-sm text-stone-500">
          {strings.footer}{' '}
          <Link href={`/${locale}/credits`} className="text-amber-700 underline">
            {strings.credits}
          </Link>
        </footer>
      </body>
    </html>
  )
}
