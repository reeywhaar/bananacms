import { notFound, required, type Context } from '@reeywhaar/bananacms'
import { cms } from '../cms.ts'

// The demo's languages, as src/cms.ts names them. Every page's URL starts with
// one: /en, /fr, /es.
export const locales = cms.locales.locales.map((locale) => locale.code)
export const defaultLocale = cms.locales.default

export const isLocale = (value: string): boolean => locales.includes(value)

// the language a page's URL starts with; a URL that starts with anything else
// has no page
export async function localeOf(params: Promise<{ locale: string }>): Promise<string> {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  return locale
}

// the language a URL starts with, or the default one
export const localeOfPath = (pathname: string): string => {
  const first = pathname.split('/')[1] ?? ''
  return isLocale(first) ? first : defaultLocale
}

// The demo's own value in ctx: which of its languages the visitor's browser asks
// for first, which src/middleware.ts sets, and / sends them to
const PREFERRED_LOCALE = Symbol('PreferredLocale')

export const getPreferredLocale = (ctx: Context): string => required(ctx, PREFERRED_LOCALE)

export const setPreferredLocale = (ctx: Context, locale: string): Context =>
  ctx.set(PREFERRED_LOCALE, locale)

// "fr" for "fr-CA,fr;q=0.9,en;q=0.8", and the default locale for a browser that
// asks for none of the demo's
export function preferredLocale(header: string | null): string {
  const asked = (header ?? '')
    .split(',')
    .map((part) => part.split(';')[0]?.trim().split('-')[0]?.toLowerCase() ?? '')
  return asked.find(isLocale) ?? defaultLocale
}

// the page at `path` in each language, for the metadata's alternates: path is
// what comes after the language, like /recipes
export const languages = (path: string): Record<string, string> =>
  Object.fromEntries(locales.map((locale) => [locale, `/${locale}${path}`]))
