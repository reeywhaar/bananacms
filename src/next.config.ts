import { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

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
    // One level above src/, so Turbopack can reach /workspace/node_modules.
    root: dirname(dirname(fileURLToPath(import.meta.url))),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

export default cfg
