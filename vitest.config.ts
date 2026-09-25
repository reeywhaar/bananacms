import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [emptyModule('server-only')],
        test: {
          name: 'cms',
          include: ['cms/src/**/*.test.ts'],
          environment: 'node',
          clearMocks: true,
        },
      },
      // The end-to-end tests run the bananacms CLI against the sites in cms/test/
      // and against the demo, one site at a time: their dev servers all watch the
      // CMS's files, and a test that touches one reloads each of them.
      {
        test: {
          name: 'cms-e2e',
          include: ['cms/test/**/*.test.ts'],
          environment: 'node',
          testTimeout: 30_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'demo',
          include: ['demo/test/**/*.test.ts'],
          environment: 'node',
          testTimeout: 30_000,
          hookTimeout: 120_000,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
})

// `server-only` is resolved by @vitejs/plugin-rsc in the app; in tests it's an empty module
function emptyModule(id: string): Plugin {
  return {
    name: `empty-module:${id}`,
    enforce: 'pre',
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    load: (resolved) => (resolved === `\0${id}` ? 'export {}' : undefined),
  }
}
