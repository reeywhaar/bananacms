import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import { fileURLToPath } from 'node:url'
import {
  defaultClientConditions,
  defaultServerConditions,
  type EnvironmentOptions,
  type InlineConfig,
  type Plugin,
} from 'vite'
import { tsconfigAliases } from './tsconfig_paths.ts'

const PACKAGE = '@reeywhaar/bananacms'

// The CLI runs from the CMS's source in this repo, and from its build in dist/ in a
// site's node_modules (bin/bananacms.js). From the source, a site's imports of the
// package resolve to the source too: the exports' "bananacms-source" condition.
const fromSource = import.meta.url.endsWith('.ts')
const sourceConditions = (defaults: readonly string[]) =>
  fromSource ? { conditions: ['bananacms-source', ...defaults] } : {}

// The package goes through Vite in the server environments, as a dependency in
// node_modules as well: its import.meta.glob of the site's routes, and its 'use
// client' and 'use server' modules, need Vite's transforms.
const serverResolve: EnvironmentOptions['resolve'] = {
  noExternal: [PACKAGE],
  ...sourceConditions(defaultServerConditions),
}

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
          rsc: frameworkFile('entry.rsc'),
          ssr: frameworkFile('entry.ssr'),
          client: frameworkFile('entry.browser'),
        },
      }),
      rscThroughPackage(),
    ],
    environments: {
      client: {
        resolve: sourceConditions(defaultClientConditions),
        optimizeDeps: {
          // The package itself isn't bundled with the dependencies: its client
          // components are the ones the RSC payload names, by their own URLs.
          exclude: [PACKAGE],
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
          ].map((dependency) => `${PACKAGE} > ${dependency}`),
        },
      },
      ssr: { resolve: serverResolve },
      rsc: {
        resolve: serverResolve,
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

// a file of the framework, by its name without the extension: its source, or its
// build in dist/
export function frameworkFile(name: string): string {
  const file = `../framework/${name}${fromSource ? '.tsx' : '.js'}`
  return fileURLToPath(new URL(file, import.meta.url))
}

// @vitejs/plugin-rsc is the CMS's dependency, not the site's, so the dependencies
// it has Vite optimize resolve through the package, as in
// "@reeywhaar/bananacms > @vitejs/plugin-rsc/vendor/react-server-dom/client.browser"
function rscThroughPackage(): Plugin {
  return {
    name: 'bananacms:rsc-through-package',
    configEnvironment(_name, config) {
      if (!config.optimizeDeps?.include) return
      config.optimizeDeps.include = config.optimizeDeps.include.map((entry) =>
        entry.startsWith('@vitejs/plugin-rsc') ? `${PACKAGE} > ${entry}` : entry,
      )
    },
  }
}
