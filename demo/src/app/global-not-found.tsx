import '../index.css'
import type { Metadata } from '@reeywhaar/bananacms'
import { languageNames } from '@app/lib/i18n.ts'
import { locales } from '@app/lib/locale.ts'

export const metadata: Metadata = { title: 'Not found · bananacms' }

// for a URL no page or route answers, with no language of its own
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto max-w-3xl px-4 py-16">
          <section className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
            <h1 className="text-3xl font-bold">Page not found</h1>
            <p className="mt-3 text-stone-600">
              There is nothing at this address. The site is in{' '}
              {locales.map((locale, i) => (
                <span key={locale}>
                  {i > 0 && ', '}
                  <a href={`/${locale}`} className="text-amber-700 underline">
                    {languageNames[locale]}
                  </a>
                </span>
              ))}
              .
            </p>
          </section>
        </main>
      </body>
    </html>
  )
}
