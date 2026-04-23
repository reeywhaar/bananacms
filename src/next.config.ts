import { NextConfig } from 'next'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'

// Derive the workspace root from the actual location of next/ so Turbopack
// works in both the monorepo (next at /workspace/node_modules/next) and the
// installed-package case (next at the consumer's node_modules/next).
const nextPkgJson = createRequire(import.meta.url).resolve('next/package.json')
const turbopackRoot = dirname(dirname(dirname(nextPkgJson)))

export default function config(phase: string): NextConfig {
  const isDev = phase === 'phase-development-server'

  return {
    allowedDevOrigins: [
      ...(process.env.NEXT_PUBLIC_SERVER_URL
        ? [new URL(process.env.NEXT_PUBLIC_SERVER_URL).hostname]
        : []),
      ...(process.env.ALLOWED_HOSTS?.split(',') ?? []),
    ],
    assetPrefix: '/cms-static',
    images: {
      localPatterns: [{ pathname: '/d/**' }],
    },
    logging: {
      incomingRequests: false,
    },
    // Turbopack is only used in dev — production builds use webpack, which
    // handles serverExternalPackages (native addons like @libsql/client) reliably.
    ...(isDev ? { turbopack: { root: turbopackRoot } } : {}),
    serverExternalPackages: ['@libsql/client', 'sharp'],
    experimental: {
      serverActions: {
        bodySizeLimit: '10mb',
      },
    },
  }
}
