import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { logLines, siteCli } from './cli.ts'

// End-to-end tests on the site in cms/test/groups-site, laid out like
// vyrtsev-bananacms: no src/app/layout.tsx, a root layout in the (main) group and
// another in showcase/, and a global-not-found.tsx.

const { startServer } = siteCli(fileURLToPath(new URL('groups-site', import.meta.url)))
const dataPath = mkdtempSync(join(tmpdir(), 'bananacms-groups-'))
let server: Awaited<ReturnType<typeof startServer>>
const request = (path: string) => fetch(server.url + path, { redirect: 'manual' })
const page = async (path: string) => {
  const response = await request(path)
  const html = await response.text()
  return {
    status: response.status,
    title: /<title>([^<]*)<\/title>/.exec(html)?.[1],
    header: /<header>([^<]*)<\/header>/.exec(html)?.[1],
    heading: /<h1>([^<]*)<\/h1>/.exec(html)?.[1],
    html,
  }
}

beforeAll(async () => {
  server = await startServer('dev', dataPath)
})

afterAll(() => {
  server?.stop()
  rmSync(dataPath, { recursive: true, force: true })
})

describe('root layouts', () => {
  it('renders each page in the root layout above it', async () => {
    expect(await page('/')).toMatchObject({ status: 200, header: 'Main', heading: 'Home' })
    expect(await page('/posts/1')).toMatchObject({ title: 'Post 1 | Groups', header: 'Main' })
    expect(await page('/showcase')).toMatchObject({ title: 'Showcase', header: 'Showcase' })
  })

  it("names each page's root layout in its payload, for the browser to load another as a document", async () => {
    expect(await (await request('/_.rsc')).text()).toContain(
      '"rootLayout":"/src/app/(main)/layout.tsx"',
    )
    expect(await (await request('/showcase_.rsc')).text()).toContain(
      '"rootLayout":"/src/app/showcase/layout.tsx"',
    )
  })
})

describe('not found', () => {
  it("renders the not-found.tsx closest to a page, which its layout's template titles", async () => {
    for (const path of ['/posts/missing', '/posts/gone']) {
      expect(await page(path), path).toMatchObject({
        status: 404,
        title: '404 | Groups',
        header: 'Main',
        heading: 'Main not found',
      })
    }
  })

  it("renders it inside the layouts down to its folder for a notFound() from generateMetadata(), and in the page's place for one from the page", async () => {
    const fromMetadata = await page('/deep/missing')
    expect(fromMetadata).toMatchObject({ status: 404, heading: 'Main not found' })
    expect(fromMetadata.html).not.toContain('class="deep"')
    const fromPage = await page('/deep/gone')
    expect(fromPage).toMatchObject({ status: 404, heading: 'Main not found' })
    expect(fromPage.html).toContain('class="deep"')
  })

  it('renders global-not-found.tsx as the whole document for a URL with no route', async () => {
    const notFound = await page('/nope')
    expect(notFound).toMatchObject({
      status: 404,
      title: '404 | Groups',
      heading: 'Nothing anywhere',
    })
    expect(notFound.header).toBeUndefined()
    expect(notFound.html).toMatch(/^<!DOCTYPE html><html lang="en"><head><meta charSet="UTF-8"\/>/)
    // it gets the request's ctx
    expect(notFound.html).toContain('No page at <!-- -->/nope')
    expect(await (await request('/nope_.rsc')).text()).toContain(
      '"rootLayout":"/src/app/global-not-found.tsx"',
    )
  })
})

it('logs no errors', () => {
  expect(logLines(server.output()).filter((line) => line.level === 'error')).toEqual([])
})
