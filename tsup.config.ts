import { defineConfig } from 'tsup'
import { cp, readFile, writeFile } from 'node:fs/promises'
import { glob } from 'node:fs/promises'

export default defineConfig((options) => ({
  entry: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/test/**',
    '!src/.next/**',
  ],
  outDir: 'dist',
  format: 'esm',
  target: 'node24',
  bundle: false,
  dts: false,
  sourcemap: true,
  // Skip clean in --watch: tsc --watch runs alongside tsup and emits .d.ts
  // into the same dist/. If tsup re-cleans on every rebuild, those
  // declarations get wiped and consumers' CMS types degrade to `any` until
  // the next tsc pass catches up.
  clean: !options.watch,
  tsconfig: './src/tsconfig.json',
  async onSuccess() {
    await cp('src/screens/Manage/globals.css', 'dist/screens/Manage/globals.css')

    // Rewrite .ts/.tsx extensions in relative-import specifiers to .js.
    // Source files intentionally use .ts so Node can run them raw in dev; tsup
    // preserves the literal specifier on emit, so the extension has to be
    // patched here to produce valid Node ESM under dist/.
    // Also handles extension-less relative imports (e.g. from third-party
    // packages re-exported without extension) by appending .js when there is
    // no extension at all on the specifier.
    const importRe = /(\b(?:from|import)\s*\(?\s*["'])(\.{1,2}\/[^"']*?)(\.tsx?)?(['"])/g

    // Undo esbuild's export hoisting: it rewrites `export const x = …` as
    // `const x = …; export { x };`. Next.js's proxy/route static analysis
    // only recognises the inline form, so reverse it. Idempotent — if a
    // file doesn't match the hoisted pattern exactly, it's left alone.
    const groupExportRe = /^\s*export\s*\{\s*([^}]+?)\s*\}\s*;?\s*$/m
    const entryRe = /^(\w+)(?:\s+as\s+(\w+))?$/

    for await (const path of glob('dist/**/*.js')) {
      let src = await readFile(path, 'utf8')
      const original = src
      src = src.replace(importRe, (_, pre, spec, ext, post) => {
        // Already has a non-TS extension (e.g. .css, .json, .js) — leave it alone
        if (ext === undefined && /\.[a-z]+$/.test(spec)) return pre + spec + post
        return `${pre}${spec}.js${post}`
      })

      const m = src.match(groupExportRe)
      if (m) {
        const entries = m[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        const parsed = entries.map((e) => e.match(entryRe))
        if (parsed.every(Boolean)) {
          let patched = src.slice(0, m.index) + src.slice(m.index + m[0].length)
          let ok = true
          for (const match of parsed) {
            const local = match![1]
            const exported = match![2] ?? local
            if (exported === 'default') {
              const re = new RegExp(`^(\\s*)var\\s+${local}\\s*=\\s*`, 'm')
              if (!re.test(patched)) {
                ok = false
                break
              }
              patched = patched.replace(re, '$1export default ')
            } else if (exported === local) {
              const re = new RegExp(
                `^(\\s*)((?:async\\s+function\\*?|function\\*?|class|const|let|var))\\s+${local}\\b`,
                'm',
              )
              if (!re.test(patched)) {
                ok = false
                break
              }
              patched = patched.replace(re, `$1export $2 ${local}`)
            } else {
              // Renamed non-default export — leave whole block intact.
              ok = false
              break
            }
          }
          if (ok) src = patched
        }
      }

      if (src !== original) await writeFile(path, src)
    }
  },
}))
