import { createCMS } from '@reeywhaar/bananacms'
import { langConfig } from './lib/langconfig.ts'

export const cms = createCMS({
  locales: {
    default: langConfig.defaultLocale,
    locales: langConfig.locales,
  },
})
