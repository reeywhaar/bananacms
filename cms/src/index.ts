// Server API for sites: server components, server actions, middleware and migrations.
// the request's context (docs/context.md)
export {
  Context,
  getAuth,
  getCookies,
  getDb,
  getDerivedDb,
  getLogger,
  getParams,
  getRequest,
  getUrl,
  required,
  setLogger,
  type Auth,
} from './framework/context.ts'
export type { CookieOptions, Cookies } from './framework/cookies.ts'
export type { Middleware } from './framework/middleware.ts'
export type {
  LayoutProps,
  PageProps,
  Params,
  SearchParams,
  SegmentProps,
} from './framework/routes.ts'
export type { Metadata, ResolvedMetadata, ResolvingMetadata } from './framework/metadata.ts'
export type { Sitemap } from './framework/sitemap.ts'
export type { LogFields, Logger } from './lib/logger/Logger.ts'
export { defineAction } from './framework/actions.ts'
export { notFound } from './framework/not-found.ts'
export { permanentRedirect, redirect } from './framework/redirect.ts'
export { createMigration, type Migration } from './lib/migrations/migration.ts'

// src/cms.ts
export {
  createCMS,
  type CMSConfig,
  type CMSLocale,
  type CMSLocalesConfig,
} from './framework/cms-config.ts'

// assets and blocks, for rendering CMS content
export { getAssetUrl, getOptimizedAssetSrcSet, getOptimizedAssetUrl } from './lib/getAssetUrl.ts'
export {
  getImagesMetadata,
  imageDimensionsFromContent,
  imageMetadataFromContents,
  type ImageLayout,
} from './lib/getImagesMetadata.ts'
export type {
  BlockData,
  BlockParent,
  BlockType,
  BlockTypeGroup,
  BlockTypeImage,
  BlockTypeMeta,
  BlockTypeText,
  SerializedBlock,
  SerializedGroupBlock,
  SerializedImageBlock,
  SerializedMetaBlock,
  SerializedTextBlock,
} from './lib/blocks/declarations.ts'
