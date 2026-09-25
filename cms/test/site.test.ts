import { mkdtempSync, rmSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { logLines, siteCli, submitForm } from './cli.ts'

// End-to-end tests of the framework on the site in cms/test/site, whose routes are
// made to reach its corners, served by `bananacms dev`.

const { startServer } = siteCli(fileURLToPath(new URL('site', import.meta.url)))
const dataPath = mkdtempSync(join(tmpdir(), 'bananacms-site-'))
let server: Awaited<ReturnType<typeof startServer>>
const request = (path: string, init: RequestInit = {}) =>
  fetch(server.url + path, { redirect: 'manual', ...init })

beforeAll(async () => {
  server = await startServer('dev', dataPath)
})

afterAll(() => {
  server?.stop()
  rmSync(dataPath, { recursive: true, force: true })
})

describe('metadata', () => {
  const titleOf = async (path: string) =>
    /<title>([^<]*)<\/title>/.exec(await (await request(path)).text())?.[1]

  it('puts a title through the templates of the layouts above its folder', async () => {
    expect(await titleOf('/')).toBe('Home')
    expect(await titleOf('/posts/1')).toBe('Post 1 | Fixture')
    expect(await titleOf('/blog')).toBe('Index | Fixture')
    expect(await titleOf('/blog/hello')).toBe('hello | Blog | Fixture')
  })

  it("gives generateMetadata() the page's params, and the metadata above as its parent", async () => {
    expect(await (await request('/blog/hello')).text()).toContain(
      '<meta name="description" content="Root and hello"/>',
    )
  })

  it('renders the not-found page with its own metadata and a 404, for a notFound() from generateMetadata() or the page', async () => {
    for (const path of ['/posts/missing', '/posts/gone', '/nope']) {
      const response = await request(path)
      expect(response.status, path).toBe(404)
      const html = await response.text()
      expect(html, path).toContain('Nothing here')
      expect(html, path).toContain('<title>Not found | Fixture</title>')
      expect(html, path).not.toContain('Post ')
    }
    // metadata resolves before rendering, so client-side navigation gets the 404 too
    expect((await request('/posts/missing_.rsc')).status).toBe(404)
  })

  it('redirects for a redirect() from generateMetadata(), client-side navigation included', async () => {
    const response = await request('/posts/old')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('/posts/new')
    const payload = await request('/posts/old_.rsc')
    expect(payload.headers.get('content-type')).toContain('text/x-component')
    expect(await payload.text()).toContain('/posts/new')
  })

  it('answers a form posted to a page that redirects with a 303, so the browser follows with a GET', async () => {
    const html = await (await request('/posts/1')).text()
    const response = await submitForm(`${server.url}/posts/old`, html, 'Touch', {})
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/posts/new')
  })
})

describe('route handlers', () => {
  it("answers with the function for the request's method, which reads the request from ctx", async () => {
    expect(await (await request('/api/hello?q=1')).json()).toEqual({ name: 'hello', q: '1' })
    const post = await request('/api/hello', { method: 'POST', body: 'a body' })
    expect(await post.text()).toBe('hello got a body')
  })

  it('answers HEAD from GET, OPTIONS with the methods there are, and the others with a 405', async () => {
    const head = await request('/api/hello', { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(head.headers.get('content-type')).toContain('application/json')
    expect(await head.text()).toBe('')
    const options = await request('/api/hello', { method: 'OPTIONS' })
    expect(options.status).toBe(204)
    expect(options.headers.get('allow')).toBe('GET, HEAD, POST, OPTIONS')
    expect((await request('/api/hello', { method: 'DELETE' })).status).toBe(405)
  })

  it('answers a notFound() with a 404, and a redirect() with a redirect', async () => {
    expect((await request('/api/missing')).status).toBe(404)
    const redirect = await request('/api/old')
    expect(redirect.status).toBe(307)
    expect(redirect.headers.get('location')).toBe('/api/new')
  })

  it('has the browser load its URL as a document on client-side navigation', async () => {
    const payload = await request('/api/hello_.rsc')
    expect(payload.headers.get('content-type')).toContain('text/x-component')
    expect(await payload.text()).toContain('"document":true')
  })
})

describe('no-JS mode', () => {
  it('sends a page whose content streams in whole, with no script to put it in place', async () => {
    const page = await (await request('/streamed?__nojs')).text()
    expect(page).toContain('Item 499, of')
    expect(page).not.toContain('<script')
    // with JavaScript, a script puts it in place
    expect(await (await request('/streamed')).text()).toContain('<script')
  })
})

describe('sitemaps', () => {
  it('serves a sitemap.ts as sitemap.xml', async () => {
    const response = await request('/sitemap.xml')
    expect(response.headers.get('content-type')).toBe('application/xml')
    expect(await response.text()).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '<url>',
        `<loc>${server.url}/</loc>`,
        '</url>',
        '<url>',
        `<loc>${server.url}/posts/1?a=1&amp;b=2</loc>`,
        '<lastmod>2026-01-02T03:04:05.000Z</lastmod>',
        '</url>',
        '</urlset>',
        '',
      ].join('\n'),
    )
  })
})

describe('errors', () => {
  // the trace id for a request that makes an error on purpose
  const expected = (name: string) => ({ headers: { 'x-trace-id': `expected-${name}` } })
  const failures = (traceId: string) =>
    logLines(server.output()).filter((line) => line.traceId === traceId && line.level === 'error')

  it('answers a page that throws with a 500, and the page data for the browser to render its error.tsx', async () => {
    const response = await request('/boom', expected('boom'))
    expect(response.status).toBe(500)
    const html = await response.text()
    expect(html).toContain('self.__NO_HYDRATE=1')
    // the error's digest, which the error page gets, is the request's trace id
    expect(html).toContain('expected-boom')
    expect(failures('expected-boom')).toMatchObject([
      { labels: ['Request', 'Render'], message: 'failed', error: 'Expected: the page broke' },
    ])
  })

  it('treats an error from generateMetadata() or the root layout the same way', async () => {
    expect((await request('/blog/meta-broken', expected('metadata'))).status).toBe(500)
    expect(failures('expected-metadata')).toMatchObject([{ error: 'Expected: the metadata broke' }])
    expect((await request('/?break-layout', expected('layout'))).status).toBe(500)
    expect(failures('expected-layout')).toMatchObject([{ error: 'Expected: the layout broke' }])
  })

  it('keeps the rest of the page for an error inside a Suspense boundary', async () => {
    const response = await request('/blog/deep', expected('deep'))
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<header>Fixture site</header>')
    expect(failures('expected-deep')).toMatchObject([
      { error: 'Expected: a part of the post broke' },
    ])
  })

  it("rejects an error.tsx without 'use client'", async () => {
    const response = await request('/server-error-page', expected('server-error-page'))
    expect(response.status).toBe(500)
    expect(failures('expected-server-error-page')).toMatchObject([
      {
        error:
          "/src/app/server-error-page/error.tsx needs 'use client' at its top: an error page is a client component",
      },
    ])
  })
})

it('keeps serving once the framework reloads, as the dev server does when it finds new dependencies', async () => {
  const reloads = () => server.output().split('(rsc) hot updated').length
  const before = reloads()
  const now = new Date()
  utimesSync(fileURLToPath(new URL('../src/framework/context.ts', import.meta.url)), now, now)
  for (let waited = 0; reloads() === before && waited < 10_000; waited += 50) await sleep(50)
  expect(reloads()).toBeGreaterThan(before)
  expect((await request('/posts/1')).status).toBe(200)
})

it('logs no errors but the ones the tests make', () => {
  const errors = logLines(server.output()).filter(
    (line) => line.level === 'error' && !String(line.traceId).startsWith('expected-'),
  )
  expect(errors).toEqual([])
})
