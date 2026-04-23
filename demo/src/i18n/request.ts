import { getRequestConfig } from 'next-intl/server'
import { hasLocale, IntlErrorCode } from 'next-intl'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  // Typically corresponds to the `[locale]` segment
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
  const defaultMessages = (await import(`../../messages/${routing.defaultLocale}.json`)).default

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    getMessageFallback({ namespace, key, error }) {
      const path = [namespace, key].filter((part) => part != null).join('.')

      if (error.code === IntlErrorCode.MISSING_MESSAGE) {
        if (namespace && key && defaultMessages?.[namespace]?.[key]) {
          return defaultMessages?.[namespace]?.[key]
        }
        return `Missing message: ${path}`
      } else {
        return 'Dear developer, please fix this message: ' + path
      }
    },
  }
})
