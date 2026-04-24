import { NextConfig } from 'next'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'

// Derive the workspace root from the actual location of next/ so Turbopack
// works in both the monorepo (next at /workspace/node_modules/next) and the
// installed-package case (next at the consumer's node_modules/next).
const nextPkgJson = createRequire(import.meta.url).resolve('next/package.json')
const turbopackRoot = dirname(dirname(dirname(nextPkgJson)))

const cfg: NextConfig = {
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
  turbopack: {
    root: turbopackRoot,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

export default cfg
