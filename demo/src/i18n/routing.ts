import { langConfig } from '@app/lib/langconfig'
import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: langConfig.locales.map((l) => l.code),
  defaultLocale: langConfig.defaultLocale,
  localePrefix: 'as-needed',
})
