// File routes, as a table from route files to URL patterns. Every
// src/app/**/page.tsx is a page, wrapped in the layout.tsx files of its folder
// and the folders above it. A route.ts answers its folder's URL with a function
// per HTTP method, and a sitemap.ts serves sitemap.xml in its folder. Folder names
// use URLPattern syntax, which is also what they compile to:
//
//   src/app/page.tsx               /
//   src/app/notes/page.tsx         /notes
//   src/app/notes/:id/page.tsx     /notes/abc      params.id = 'abc'
//   src/app/docs/:slug+/page.tsx   /docs/a/b       params.slug = ['a', 'b']
//   src/app/shop/:path*/page.tsx   /shop, /shop/a  params.path = undefined, ['a']
//   src/app/(group)/...            the folder stays out of the URL
//
// The full scheme is in docs/routing.md. routes.ts feeds this the site's files.

export type Params = Record<string, string | string[]>

type Segment =
  | { type: 'static'; value: string }
  | { type: 'dynamic' | 'catchAll' | 'optionalCatchAll'; name: string }

// what serves a route's URLs
export type RouteKind = 'page' | 'handler' | 'sitemap'

const KINDS: Record<string, RouteKind> = {
  'page.tsx': 'page',
  'route.ts': 'handler',
  'sitemap.ts': 'sitemap',
}

export type Route = {
  kind: RouteKind
  file: string
  // folders from src/app down to the route file's, route groups included
  folders: string[]
  segments: Segment[]
  pattern: URLPattern
}

const APP_DIR = '/src/app'

// More specific routes first: at the first segment where two routes differ,
// a static segment beats a dynamic one, which beats a catch-all.
const RANKS = { static: 0, dynamic: 1, catchAll: 2, optionalCatchAll: 3 }

export function createRoutes(files: string[]): Route[] {
  const routes = files.map((file): Route => {
    const parts = file.slice(APP_DIR.length + 1).split('/')
    const kind = KINDS[parts.at(-1) ?? '']
    if (!kind) throw new Error(`${file} is not a page.tsx, route.ts or sitemap.ts`)
    const folders = parts.slice(0, -1)
    const segments = folders.flatMap((folder) => parseFolder(folder) ?? [])
    if (kind === 'sitemap') segments.push({ type: 'static', value: 'sitemap.xml' })
    return {
      kind,
      file,
      folders,
      segments,
      pattern: new URLPattern({ pathname: toPattern(segments) }),
    }
  })
  rejectDuplicates(routes)
  return routes.sort((a, b) => compareSpecificity(a.segments, b.segments))
}

// Two files that serve the same URLs, like a page.tsx and a route.ts in one
// folder, or two route groups with the same folders below them. The names of
// params don't tell URLs apart: `:id` and `:slug` in one place match the same ones.
function rejectDuplicates(routes: Route[]): void {
  const files = new Map<string, string>()
  for (const route of routes) {
    const urls = JSON.stringify(
      route.segments.map((segment) =>
        segment.type === 'static' ? [segment.type, segment.value] : [segment.type],
      ),
    )
    const other = files.get(urls)
    if (other) {
      throw new Error(`${other} and ${route.file} serve the same URLs (see docs/routing.md)`)
    }
    files.set(urls, route.file)
  }
}

export function findRoute(
  routes: Route[],
  pathname: string,
): { route: Route; params: Params } | undefined {
  const path = pathname.replace(/\/+$/, '') || '/'
  for (const route of routes) {
    const groups =
      route.pattern.exec({ pathname: path })?.pathname.groups ??
      // `/:slug*` needs a slash before the segments, so a root `:slug*` gets `/` here
      (path === '/' && route.segments.length === 1 && route.segments[0].type === 'optionalCatchAll'
        ? {}
        : undefined)
    const params = groups && toParams(route.segments, groups)
    if (params) return { route, params }
  }
}

// The files called `name` that exist around a page in `folders`, like its
// layout.tsx files, outermost first. Each has its depth: how many folders below
// src/app it is.
export function folderFiles(
  folders: string[],
  name: string,
  exists: (file: string) => boolean,
): { file: string; depth: number }[] {
  return [0, ...folders.map((_, i) => i + 1)]
    .map((depth) => ({ file: [APP_DIR, ...folders.slice(0, depth), name].join('/'), depth }))
    .filter(({ file }) => exists(file))
}

function parseFolder(folder: string): Segment | undefined {
  if (/^\(.+\)$/.test(folder)) return undefined
  const param = /^:(\w+)([+*]?)$/.exec(folder)
  if (param) {
    const [, name, modifier] = param
    const type = modifier === '+' ? 'catchAll' : modifier === '*' ? 'optionalCatchAll' : 'dynamic'
    return { type, name }
  }
  // catches Next.js-style names, e.g. ones left over from a migration
  if (/^\[.*\]$/.test(folder)) {
    throw new Error(
      `Route folder "${folder}" uses Next.js syntax: name it like ":id", ":slug+" or ":slug*" (see docs/routing.md)`,
    )
  }
  return { type: 'static', value: folder }
}

function toPattern(segments: Segment[]): string {
  const pattern = segments
    .map((segment) => {
      switch (segment.type) {
        case 'static':
          return `/${segment.value.replace(/[:*+?(){}\\]/g, '\\$&')}`
        case 'dynamic':
          return `/:${segment.name}`
        case 'catchAll':
          return `/:${segment.name}+`
        case 'optionalCatchAll':
          return `/:${segment.name}*`
      }
    })
    .join('')
  return pattern || '/'
}

function compareSpecificity(a: Segment[], b: Segment[]): number {
  const rank = (segment: Segment | undefined) => (segment ? RANKS[segment.type] : -1)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = rank(a[i]) - rank(b[i])
    if (difference !== 0) return difference
  }
  return 0
}

function toParams(
  segments: Segment[],
  groups: Record<string, string | undefined>,
): Params | undefined {
  const params: Params = {}
  try {
    for (const segment of segments) {
      if (segment.type === 'static') continue
      const value = groups[segment.name]
      if (!value) continue // an optional catch-all with zero segments
      params[segment.name] =
        segment.type === 'dynamic'
          ? decodeURIComponent(value)
          : value.split('/').map((part) => decodeURIComponent(part))
    }
  } catch {
    return undefined // malformed percent-encoding counts as a mismatch
  }
  return params
}
