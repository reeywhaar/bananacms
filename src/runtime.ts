// Runtime API — loaded only through a bundler (Next/webpack/turbopack).
// Keep this separate from the main `bananacms` entry so that Next.js's
// next.config.ts transpilation (CJS) does not eagerly pull in request-time
// code (DB services, middleware, store-dependent helpers).

// Server-side request context
export { getServices, requireAuth, type AuthData } from './services/getServices'

// Asset helpers (URL formation, optimized srcset)
export { getImagesMetadata } from './lib/getImagesMetadata'

// Block system — types needed by consumers rendering blocks
export type {
  BlockData,
  BlockParent,
  BlockType,
  BlockTypeText,
  BlockTypeGroup,
  BlockTypeImage,
  BlockTypeMeta,
  SerializedBlock,
  SerializedTextBlock,
  SerializedGroupBlock,
  SerializedImageBlock,
  SerializedMetaBlock,
} from './lib/blocks/declarations'

// Proxy / middleware primitives consumers compose into their own proxy.ts
export { combineProxies, adaptNextProxy } from './proxies/combine'
export type { ProxyMiddleware, Awaitable } from './proxies/combine'

// CMS-zone middleware factory + matcher configs
export { createCMSMiddleware, cmsMiddlewareConfig, consumerMiddlewareConfig } from './cmsProxy'
