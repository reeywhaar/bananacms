import type { CMSConfig } from './cms-config.ts'

const siteConfigModules = import.meta.glob<Record<string, unknown>>('/src/cms.ts', {
  eager: true,
})

const DEFAULT_CONFIG: CMSConfig = { locales: { default: 'en', locales: [{ code: 'en' }] } }

// the config the site's src/cms.ts exports, as `cms` or as its default export; a
// site without one is English only
export function getSiteConfig(): CMSConfig {
  const module = Object.values(siteConfigModules)[0]
  return (module?.cms ?? module?.default ?? DEFAULT_CONFIG) as CMSConfig
}
