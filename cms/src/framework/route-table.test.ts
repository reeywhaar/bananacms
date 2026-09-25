import { describe, expect, it } from 'vitest'
import { createRoutes, findRoute, folderFiles } from './route-table.ts'

const routes = createRoutes([
  '/src/app/page.tsx',
  '/src/app/notes/page.tsx',
  '/src/app/notes/new/page.tsx',
  '/src/app/notes/:id/page.tsx',
  '/src/app/docs/:slug+/page.tsx',
  '/src/app/shop/:path*/page.tsx',
  '/src/app/(marketing)/about/page.tsx',
  '/src/app/:lang/page.tsx',
])

function match(pathname: string, table = routes) {
  const found = findRoute(table, pathname)
  return found && { file: found.route.file, params: found.params }
}

describe('findRoute', () => {
  it('matches static routes', () => {
    expect(match('/')).toEqual({ file: '/src/app/page.tsx', params: {} })
    expect(match('/notes')).toEqual({ file: '/src/app/notes/page.tsx', params: {} })
  })

  it('ignores a trailing slash', () => {
    expect(match('/notes/')?.file).toBe('/src/app/notes/page.tsx')
    expect(match('/notes/abc/')?.params).toEqual({ id: 'abc' })
  })

  it('passes dynamic segments as decoded params', () => {
    expect(match('/notes/abc')).toEqual({
      file: '/src/app/notes/:id/page.tsx',
      params: { id: 'abc' },
    })
    expect(match('/notes/a%20b%2Fc')?.params).toEqual({ id: 'a b/c' })
  })

  it('prefers static segments over dynamic ones', () => {
    expect(match('/notes/new')?.file).toBe('/src/app/notes/new/page.tsx')
    expect(match('/notes')?.file).toBe('/src/app/notes/page.tsx')
    expect(match('/fr')).toEqual({ file: '/src/app/:lang/page.tsx', params: { lang: 'fr' } })
  })

  it('passes catch-all segments as arrays', () => {
    expect(match('/docs/a')?.params).toEqual({ slug: ['a'] })
    expect(match('/docs/a/b%20c')?.params).toEqual({ slug: ['a', 'b c'] })
    // a catch-all needs at least one segment
    expect(match('/docs')?.file).toBe('/src/app/:lang/page.tsx')
  })

  it('matches optional catch-alls with and without segments', () => {
    expect(match('/shop')).toEqual({ file: '/src/app/shop/:path*/page.tsx', params: {} })
    expect(match('/shop/a/b')?.params).toEqual({ path: ['a', 'b'] })

    const root = createRoutes(['/src/app/:slug*/page.tsx'])
    expect(match('/', root)?.params).toEqual({})
    expect(match('/a/b', root)?.params).toEqual({ slug: ['a', 'b'] })
  })

  it('leaves route groups out of the URL', () => {
    expect(match('/about')?.file).toBe('/src/app/(marketing)/about/page.tsx')
    expect(match('/marketing/about')).toBeUndefined()
  })

  it('does not match unknown paths or malformed escapes', () => {
    expect(match('/notes/a/b')).toBeUndefined()
    expect(match('/notes/%E0%A4%A')).toBeUndefined()
  })
})

describe('createRoutes', () => {
  it('rejects Next.js-style folder names', () => {
    expect(() => createRoutes(['/src/app/notes/[id]/page.tsx'])).toThrow(
      'Route folder "[id]" uses Next.js syntax',
    )
    expect(() => createRoutes(['/src/app/docs/[...slug]/page.tsx'])).toThrow('Next.js syntax')
  })

  it("takes each file's kind from its name, and serves a sitemap.ts as sitemap.xml", () => {
    const table = createRoutes([
      '/src/app/rss/route.ts',
      '/src/app/sitemap.ts',
      '/src/app/blog/sitemap.ts',
      '/src/app/:id/page.tsx',
    ])
    expect(findRoute(table, '/rss')?.route.kind).toBe('handler')
    expect(findRoute(table, '/sitemap.xml')?.route).toMatchObject({
      kind: 'sitemap',
      file: '/src/app/sitemap.ts',
    })
    expect(findRoute(table, '/blog/sitemap.xml')?.route.file).toBe('/src/app/blog/sitemap.ts')
    expect(findRoute(table, '/other')?.route.kind).toBe('page')
  })

  it('rejects two files that serve the same URLs', () => {
    expect(() => createRoutes(['/src/app/rss/page.tsx', '/src/app/rss/route.ts'])).toThrow(
      '/src/app/rss/page.tsx and /src/app/rss/route.ts serve the same URLs',
    )
    expect(() => createRoutes(['/src/app/(a)/x/page.tsx', '/src/app/(b)/x/page.tsx'])).toThrow(
      'serve the same URLs',
    )
    expect(() => createRoutes(['/src/app/:id/page.tsx', '/src/app/:slug/page.tsx'])).toThrow(
      'serve the same URLs',
    )
    // a folder named like a kind of param is a literal one all the same
    expect(() => createRoutes(['/src/app/dynamic/page.tsx', '/src/app/:id/page.tsx'])).not.toThrow()
  })

  it('keeps special characters in static folders literal', () => {
    const table = createRoutes(['/src/app/a+b/page.tsx'])
    expect(match('/a+b', table)?.file).toBe('/src/app/a+b/page.tsx')
    expect(match('/aab', table)).toBeUndefined()
  })
})

describe('folderFiles', () => {
  const existing = new Set([
    '/src/app/layout.tsx',
    '/src/app/(marketing)/layout.tsx',
    '/src/app/notes/:id/layout.tsx',
  ])
  const exists = (file: string) => existing.has(file)

  it('lists the files that exist around a page, outermost first, with their depths', () => {
    expect(folderFiles([], 'layout.tsx', exists)).toEqual([
      { file: '/src/app/layout.tsx', depth: 0 },
    ])
    expect(folderFiles(['notes', ':id'], 'layout.tsx', exists)).toEqual([
      { file: '/src/app/layout.tsx', depth: 0 },
      { file: '/src/app/notes/:id/layout.tsx', depth: 2 },
    ])
  })

  it('includes files in route groups', () => {
    expect(folderFiles(['(marketing)', 'about'], 'layout.tsx', exists)).toEqual([
      { file: '/src/app/layout.tsx', depth: 0 },
      { file: '/src/app/(marketing)/layout.tsx', depth: 1 },
    ])
  })
})
