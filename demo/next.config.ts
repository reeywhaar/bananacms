import { createConfig } from '@reeywhaar/bananacms'
import createNextIntlPlugin from 'next-intl/plugin'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
// Side-effect import: runs createCMS() so getCMS() is populated before any request-time code.
import './src/cms'

const cfg = createConfig((base) => ({
  ...base,
  turbopack: {
    ...base.turbopack,
    // One level above demo/, so Turbopack can reach /workspace/node_modules
    // and the sibling bananacms package at /workspace/src.
    root: dirname(dirname(fileURLToPath(import.meta.url))),
  },
}))

const withNextIntl = createNextIntlPlugin({
  experimental: {
    srcPath: './src',
    messages: {
      format: 'json',
      locales: 'infer',
      path: './messages',
      precompile: true,
    },
  },
})

export default withNextIntl(cfg)
