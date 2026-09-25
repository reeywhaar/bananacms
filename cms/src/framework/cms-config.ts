// A site's CMS settings, which its src/cms.ts passes to createCMS() as with
// bananacms:
//
//   import { createCMS } from '@reeywhaar/bananacms'
//
//   export const cms = createCMS({
//     locales: { default: 'en', locales: [{ code: 'en' }, { code: 'ru', flag: '🇷🇺' }] },
//   })

export interface CMSLocale {
  code: string
  flag?: string
}

export interface CMSLocalesConfig {
  default: string
  locales: CMSLocale[]
}

export interface CMSConfig {
  // the languages content is translated into; the admin edits each of them
  locales: CMSLocalesConfig
}

export function createCMS(config: CMSConfig): CMSConfig {
  return config
}
