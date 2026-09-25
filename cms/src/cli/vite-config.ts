import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import { fileURLToPath } from 'node:url'
import type { InlineConfig } from 'vite'
import { tsconfigAliases } from './tsconfig-paths.ts'

// The Vite config every site runs with: the CMS owns the RSC plumbing, and a
// site provides its routes in src/app/ (framework/routes.ts).
export function createViteConfig(root: string): InlineConfig {
  return {
    root,
    configFile: false,
    // Lightning CSS processes all CSS, in dev as in builds: it lowers nesting for
    // the build targets, and browsers drop some of the nested rules Tailwind
    // writes, such as its ::placeholder color.
    css: { transformer: 'lightningcss' },
    // the `paths` of the site's tsconfig.json, like "@app/*", in code and in CSS
    resolve: { alias: tsconfigAliases(root) },
    plugins: [
      tailwindcss(),
      // enables fast refresh for client components
      react(),
      rsc({
        // one entry per Vite environment:
        // - rsc: renders server components into an RSC stream, runs server actions
        // - ssr: turns the RSC stream into HTML for the initial page load
        // - client: hydrates the HTML and re-fetches RSC on navigation
        entries: {
          rsc: frameworkFile('entry.rsc.tsx'),
          ssr: frameworkFile('entry.ssr.tsx'),
          client: frameworkFile('entry.browser.tsx'),
        },
      }),
    ],
    environments: {
      client: {
        optimizeDeps: {
          // The admin's browser dependencies, optimized when the dev server starts.
          // Found later, as a /manage page first asks for them, they'd make Vite
          // reload the page mid-navigation.
          include: [
            '@badrap/valita',
            '@dnd-kit/core',
            '@dnd-kit/sortable',
            '@dnd-kit/utilities',
            'disposablestack/auto',
            'json5',
            'music-metadata',
            'uuid',
          ].map((dependency) => `@reeywhaar/bananacms > ${dependency}`),
        },
      },
      rsc: {
        build: {
          rolldownOptions: {
            // modules with inline server actions (e.g. the demo's PollBlock) are also
            // imported statically by pages; one chunk for both is fine on the server
            checks: { ineffectiveDynamicImport: false },
          },
        },
      },
    },
  }
}

export function frameworkFile(name: string): string {
  return fileURLToPath(new URL(`../framework/${name}`, import.meta.url))
}
