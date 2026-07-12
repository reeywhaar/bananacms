import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

type BinField = string | Record<string, string>

/**
 * Absolute path to a dependency's JS bin entry, resolved from `fromDir`'s
 * dependency tree. Spawn the result with `process.execPath` (the current
 * node-or-bun binary) so child tools run under whichever runtime launched the
 * CLI — no `npx`/`bunx` and no PATH lookup, which the `oven/bun` image lacks.
 *
 * `spec` is a package name (`'next'`) or `pkg:binName` when the package ships
 * several bins under different names. Throws if the package isn't installed.
 */
export function binEntry(fromDir: string, spec: string): string {
  const [pkg, binName] = spec.includes(':') ? spec.split(':') : [spec, spec]
  const require = createRequire(resolve(fromDir, 'package.json'))
  const pkgJsonPath = require.resolve(`${pkg}/package.json`)
  const bin = (require(pkgJsonPath) as { bin?: BinField }).bin
  const rel = typeof bin === 'string' ? bin : bin?.[binName]
  if (!rel) throw new Error(`${pkg} has no bin entry "${binName}"`)
  return resolve(dirname(pkgJsonPath), rel)
}
