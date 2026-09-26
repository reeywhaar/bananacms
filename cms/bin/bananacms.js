#!/usr/bin/env node
import { registerHooks } from 'node:module'

// In a site's node_modules, Node strips no types, so the CLI runs from its build in
// dist/. In this repo it runs from its source, and resolves @reeywhaar/bananacms to
// the source as well, for the site's migrations that import it: the exports'
// "bananacms-source" condition.
if (import.meta.url.includes('/node_modules/')) {
  await import('../dist/cli/index.js')
} else {
  registerHooks({
    resolve: (specifier, context, nextResolve) =>
      nextResolve(specifier, {
        ...context,
        conditions: [...context.conditions, 'bananacms-source'],
      }),
  })
  await import('../src/cli/index.ts')
}
