import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { Alias } from 'vite'

// The `paths` of a site's tsconfig.json, like "@app/*": ["./src/*"], as Vite
// aliases, so imports in code and in CSS, Sass's @use included, resolve as
// TypeScript resolves them. They come from the site's tsconfig.json, or from the
// nearest file up its `extends` that sets them, relative to that file (or to its
// `baseUrl`). A pattern maps to its first target.
//
// A pattern that starts with `*` is left out: TypeScript falls back to packages
// when its target has no such file, and an alias can't, so it would take over
// every import, `react` included.
export function tsconfigAliases(root: string): Alias[] {
  const found = readPaths(resolve(root, 'tsconfig.json'))
  if (!found) return []
  return Object.entries(found.paths).flatMap(([pattern, [target]]) =>
    target === undefined || pattern.startsWith('*')
      ? []
      : [toAlias(pattern, resolve(found.base, target))],
  )
}

type TsConfig = {
  extends?: string | string[]
  compilerOptions?: { paths?: Record<string, string[]>; baseUrl?: string }
}

function readPaths(file: string): { paths: Record<string, string[]>; base: string } | undefined {
  if (!existsSync(file)) return undefined
  const config = parseJsonc(readFileSync(file, 'utf8')) as TsConfig
  const { paths, baseUrl } = config.compilerOptions ?? {}
  if (paths) return { paths, base: resolve(dirname(file), baseUrl ?? '.') }
  // the last of several configs it extends wins, as in TypeScript; a package's
  // shared config has no paths into the site
  for (const parent of [config.extends ?? []].flat().toReversed()) {
    if (!parent.startsWith('.')) continue
    const found = readPaths(
      resolve(dirname(file), parent.endsWith('.json') ? parent : `${parent}.json`),
    )
    if (found) return found
  }
  return undefined
}

function toAlias(pattern: string, target: string): Alias {
  const star = pattern.indexOf('*')
  if (star < 0) return { find: new RegExp(`^${escapeRegExp(pattern)}$`), replacement: target }
  const prefix = escapeRegExp(pattern.slice(0, star))
  const suffix = escapeRegExp(pattern.slice(star + 1))
  return { find: new RegExp(`^${prefix}(.*)${suffix}$`), replacement: target.replace('*', '$1') }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// JSON with the comments and trailing commas tsconfig.json allows
export function parseJsonc(text: string): unknown {
  let json = ''
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      let end = i + 1
      while (end < text.length && text[end] !== '"') end += text[end] === '\\' ? 2 : 1
      json += text.slice(i, end + 1)
      i = end
    } else if (char === '/' && text[i + 1] === '/') {
      const lineEnd = text.indexOf('\n', i)
      i = lineEnd < 0 ? text.length : lineEnd - 1
    } else if (char === '/' && text[i + 1] === '*') {
      const commentEnd = text.indexOf('*/', i + 2)
      i = commentEnd < 0 ? text.length : commentEnd + 1
    } else if (char === ',' && /^\s*[}\]]/.test(text.slice(i + 1))) {
      // a trailing comma
    } else {
      json += char
    }
  }
  return JSON.parse(json)
}
