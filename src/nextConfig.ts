import type { NextConfig } from 'next'
import type { Rewrite } from 'next/dist/lib/load-custom-routes'
import { getCMS, type CMSInstance } from './config.ts'

type Rewrites = NonNullable<NextConfig['rewrites']>

export function cmsRewrites(cms: CMSInstance = getCMS()): Rewrite[] {
  const url = (process.env.CMS_INTERNAL_URL ?? 'http://localhost:4001').replace(/\/+$/, '')
  const segments = [cms.paths.admin, cms.paths.api, cms.paths.assetDelivery, cms.paths.assetPrefix]
  return segments.map((path) => ({
    source: `${path}/:path*`,
    destination: `${url}${path}/:path*`,
  }))
}

export function mergeRewrites(base: Rewrites | undefined, extra: Rewrites): Rewrites {
  return async () => {
    const b = base ? await base() : []
    const e = await extra()
    if (Array.isArray(b) && Array.isArray(e)) return [...b, ...e]
    const bN = Array.isArray(b) ? { beforeFiles: [], afterFiles: b, fallback: [] } : b
    const eN = Array.isArray(e) ? { beforeFiles: [], afterFiles: e, fallback: [] } : e
    return {
      beforeFiles: [...(bN.beforeFiles ?? []), ...(eN.beforeFiles ?? [])],
      afterFiles: [...(bN.afterFiles ?? []), ...(eN.afterFiles ?? [])],
      fallback: [...(bN.fallback ?? []), ...(eN.fallback ?? [])],
    }
  }
}

export function createConfig(amend: (base: NextConfig) => NextConfig = (b) => b): NextConfig {
  const cms = getCMS()
  const hostname = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SERVER_URL ?? '').hostname
    } catch {
      return undefined
    }
  })()
  const base: NextConfig = {
    allowedDevOrigins: [
      ...(hostname ? [hostname] : []),
      ...(process.env.ALLOWED_HOSTS?.split(',') ?? []),
    ],
    images: {
      localPatterns: [{ pathname: `${cms.paths.assetDelivery}/**` }],
    },
    logging: {
      incomingRequests: false,
    },
    rewrites: async () => cmsRewrites(cms),
  }
  return amend(base)
}

export function createCmsZoneConfig(
  amend: (base: NextConfig) => NextConfig = (b) => b,
): NextConfig {
  const cms = getCMS()
  const base: NextConfig = {
    allowedDevOrigins: [...(process.env.ALLOWED_HOSTS?.split(',') ?? [])],
    assetPrefix: cms.paths.assetPrefix,
    images: {
      localPatterns: [{ pathname: `${cms.paths.assetDelivery}/**` }],
    },
    logging: {
      incomingRequests: false,
    },
    experimental: {
      serverActions: {
        bodySizeLimit: '10mb',
      },
    },
  }
  return amend(base)
}
