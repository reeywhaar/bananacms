import { defineConfig } from 'tsup'
import { cp, readFile, writeFile } from 'node:fs/promises'
import { glob } from 'node:fs/promises'

export default defineConfig({
  entry: ['src/**/*.ts', 'src/**/*.tsx', '!src/**/*.d.ts', '!src/.next/**'],
  outDir: 'dist',
  format: 'esm',
  target: 'node24',
  bundle: false,
  dts: false,
  sourcemap: true,
  clean: true,
  tsconfig: './src/tsconfig.json',
  async onSuccess() {
    await cp('src/lib/migrations', 'dist/lib/migrations', { recursive: true })
    await cp('src/screens/Manage/globals.css', 'dist/screens/Manage/globals.css')

    // Rewrite .ts/.tsx extensions in relative-import specifiers to .js.
    // Source files intentionally use .ts so Node can run them raw in dev; tsup
    // preserves the literal specifier on emit, so the extension has to be
    // patched here to produce valid Node ESM under dist/.
    const importRe =
      /(\b(?:from|import)\s*\(?\s*["'])(\.{1,2}\/[^"']*?)\.tsx?(["'])/g
    for await (const path of glob('dist/**/*.js')) {
      const src = await readFile(path, 'utf8')
      const patched = src.replace(importRe, (_, pre, spec, post) => `${pre}${spec}.js${post}`)
      if (patched !== src) await writeFile(path, patched)
    }
  },
})
