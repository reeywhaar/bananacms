import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Alias } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { parseJsonc, tsconfigAliases } from './tsconfig-paths.ts'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function site(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'bananacms-tsconfig-'))
  dirs.push(root)
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(join(root, file, '..'), { recursive: true })
    writeFileSync(join(root, file), content)
  }
  return root
}

// what an import resolves to, as Vite's aliases would resolve it
function resolveWith(aliases: Alias[], id: string): string | undefined {
  for (const { find, replacement } of aliases) {
    if (find instanceof RegExp && find.test(id)) return id.replace(find, replacement)
  }
  return undefined
}

describe('tsconfigAliases', () => {
  it("turns the site's paths into aliases to the files they name", () => {
    const root = site({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { paths: { '@app/*': ['./src/*'], '@config': ['./src/config.ts'] } },
      }),
    })
    const aliases = tsconfigAliases(root)
    expect(resolveWith(aliases, '@app/styles/mixins.scss')).toBe(`${root}/src/styles/mixins.scss`)
    expect(resolveWith(aliases, '@config')).toBe(`${root}/src/config.ts`)
    expect(resolveWith(aliases, '@config/other')).toBeUndefined()
    expect(resolveWith(aliases, 'react')).toBeUndefined()
  })

  it('reads comments and trailing commas, and paths relative to baseUrl', () => {
    const root = site({
      'tsconfig.json': `{
        // the site's
        "compilerOptions": {
          /* from src */ "baseUrl": "./src",
          "paths": { "~/*": ["./*"], },
        },
      }`,
    })
    expect(resolveWith(tsconfigAliases(root), '~/lib/data.ts')).toBe(`${root}/src/lib/data.ts`)
  })

  it('takes paths from a config it extends, relative to that config', () => {
    const root = site({
      'site/tsconfig.json': JSON.stringify({ extends: '../tsconfig.base' }),
      'tsconfig.base.json': JSON.stringify({
        compilerOptions: { paths: { '@shared/*': ['./shared/*'] } },
      }),
    })
    expect(resolveWith(tsconfigAliases(join(root, 'site')), '@shared/a.ts')).toBe(
      `${root}/shared/a.ts`,
    )
  })

  it('leaves out a pattern that would catch every import', () => {
    const root = site({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { paths: { '*': ['./types/*'], '@app/*': ['./src/*'] } },
      }),
    })
    const aliases = tsconfigAliases(root)
    expect(resolveWith(aliases, 'react')).toBeUndefined()
    expect(resolveWith(aliases, '@app/a.ts')).toBe(`${root}/src/a.ts`)
  })

  it('has no aliases for a site without a tsconfig.json or paths', () => {
    expect(tsconfigAliases(site({}))).toEqual([])
    expect(tsconfigAliases(site({ 'tsconfig.json': '{ "extends": "@tsconfig/node24" }' }))).toEqual(
      [],
    )
  })
})

describe('parseJsonc', () => {
  it('keeps comment markers and commas inside strings', () => {
    expect(parseJsonc('{ "a": "http://x/*y*/", "b": "c,}" }')).toEqual({
      a: 'http://x/*y*/',
      b: 'c,}',
    })
  })
})
