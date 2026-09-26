// The build's files tsc doesn't write (npm run build): the stylesheets the source
// imports, and the ambient types in types.d.ts, each copied to its place in dist/.
import { cpSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const src = fileURLToPath(new URL('../src/', import.meta.url))
const dist = fileURLToPath(new URL('../dist/', import.meta.url))

for (const file of readdirSync(src, { recursive: true, encoding: 'utf8' })) {
  if (file.endsWith('.css') || file === 'types.d.ts') {
    cpSync(path.join(src, file), path.join(dist, file))
  }
}
