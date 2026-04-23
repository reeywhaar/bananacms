// Config-time API — safe for Next.js's next.config.ts loader and for any
// consumer cms.ts module. Runtime symbols (services, middleware, asset
// helpers, block types) live in `bananacms/runtime` and should only be
// imported by code that goes through a bundler.

export {
  createCMS,
  getCMS,
  isCMSInitialized,
  type CMSInstance,
  type CMSEnv,
  type CMSLocale,
  type CMSLocalesConfig,
  type CMSPaths,
  type CMSErrorPages,
  type CreateCMSInput,
} from './config.ts'

export {
  createConfig,
  createCmsZoneConfig,
  cmsRewrites,
  mergeRewrites,
} from './nextConfig.ts'
