import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { logLines, siteCli, submitForm } from '../../cms/test/cli.ts'
import { demoRoot, seedDemo } from './seeded.ts'

// End-to-end tests: run the bananacms CLI in the demo directory on a
// throwaway database, seeded from seed/, and talk to it over HTTP like a browser
// with JavaScript off.

const { runCli, startServer } = siteCli(demoRoot)
// the seed's user
const user = { name: 'demo', password: 'demo' }

describe('bananacms dev', () => {
  const dataPath = mkdtempSync(join(tmpdir(), 'bananacms-e2e-'))
  let server: Awaited<ReturnType<typeof startServer>>
  const get = (path: string, headers: Record<string, string> = {}) =>
    fetch(server.url + path, { headers, redirect: 'manual' })
  // the page, less the comments React puts between the parts of a text
  const html = async (path: string, headers: Record<string, string> = {}) =>
    (await (await get(path, headers)).text()).replaceAll('<!-- -->', '')
  const title = async (path: string) => /<title>([^<]*)<\/title>/.exec(await html(path))?.[1]
  const logIn = async () => {
    const page = await html('/manage/login')
    const login = await submitForm(`${server.url}/manage/login`, page, 'name="password"', {
      username: user.name,
      password: user.password,
    })
    return login.headers.get('set-cookie')?.split(';')[0] ?? ''
  }

  beforeAll(async () => {
    await seedDemo(dataPath)
    server = await startServer('dev', dataPath)
  })

  afterAll(() => {
    server?.stop()
    rmSync(dataPath, { recursive: true, force: true })
  })

  it('sends / to the home page in the language the browser asks for first', async () => {
    for (const [header, location] of [
      ['fr-CA,fr;q=0.9,en;q=0.8', '/fr'],
      ['de-DE,es;q=0.8', '/es'],
      ['de-DE', '/en'],
    ]) {
      const response = await get('/', { 'accept-language': header })
      expect(response.status, header).toBe(307)
      expect(response.headers.get('location'), header).toBe(location)
    }
  })

  it('renders each page in the language its URL starts with', async () => {
    expect(await title('/en')).toBe('bananacms demo')
    expect(await title('/fr/recipes')).toBe('Recettes · bananacms')
    expect(await title('/es/movies/nosferatu')).toBe('Nosferatu · bananacms')
    expect(await title('/en/tags/vegan')).toBe('Vegan · bananacms')
    const page = await html('/es/recipes/gazpacho')
    expect(page).toContain('<html lang="es">')
    expect(page).toContain('La sopa fría de Andalucía')
    // and names the page in the other languages
    expect(page).toMatch(/<link rel="alternate" hrefLang="fr" href="[^"]*\/fr\/recipes\/gazpacho"/)
  })

  it("renders a post's blocks: markdown, HTML, attributes, tags, credits and files", async () => {
    const page = await html('/en/recipes/banana-bread')
    expect(page).toContain('<li>3 very ripe bananas, mashed</li>')
    expect(page).toContain('<strong>black skins</strong>')
    expect(page).toMatch(/Serves<\/dt><dd[^>]*>10<\/dd>/)
    expect(page).toMatch(/href="\/en\/tags\/baking"[^>]*>Baking<\/a>/)
    expect(page).toMatch(/Photo by <a href="https:\/\/unsplash\.com\/@evangelinas_photography\?/)
    expect(page).toMatch(/href="\/d\/[\w-]+"[^>]*>↓ Recipe card \(PDF\)/)
    const film = await html('/en/movies/a-trip-to-the-moon')
    expect(film).toContain('<em>coloured by hand</em>')
    expect(film).toContain('>Gallery</h2>')
    expect(film.match(/<figure/g)).toHaveLength(4)
    expect(film).toContain('href="https://en.wikipedia.org/wiki/A_Trip_to_the_Moon"')
  })

  it('serves the images in variants for each pixel density', async () => {
    const page = await html('/en/recipes/banana-bread')
    const srcSet = /srcSet="([^"]+)"/.exec(page)?.[1] ?? ''
    expect(srcSet).toMatch(/ 1x, .* 2x$/)
    const image = await get(srcSet.split(' ')[0].replaceAll('&amp;', '&'))
    expect(image.status).toBe(200)
    expect(image.headers.get('content-type')).toBe('image/jpeg')
  })

  it('shows drafts to signed-in users only', async () => {
    expect((await get('/en/recipes/ratatouille')).status).toBe(404)
    expect(await html('/en/recipes')).not.toContain('Ratatouille')
    const cookie = await logIn()
    expect(await html('/en/recipes/ratatouille', { cookie })).toContain('>Draft</span>')
  })

  it('answers unknown URLs with the not-found page, in their language, and a 404', async () => {
    for (const [path, text] of [
      ['/fr/nope', 'Page introuvable'],
      ['/xx', 'Page not found'],
      ['/en/recipes/nope', 'Page not found'],
      ['/a/b/c/d', 'Page not found'],
    ]) {
      const response = await get(path)
      expect(response.status, path).toBe(404)
      expect(await response.text(), path).toContain(text)
    }
  })

  it("searches the posts' texts in the page's language", async () => {
    expect(await html('/fr/search?q=banane')).toContain('Pain à la banane')
    expect(await html('/en/search?q=zebra')).toContain('Nothing matches that.')
  })

  it("counts a vote in the Main page's poll, which keeps its counts in the CMS", async () => {
    const page = await html('/en')
    expect(page).toMatch(/Banana bread<\/span><span[^>]*>13 · /)
    const response = await submitForm(`${server.url}/en`, page, '<span>Banana bread</span>', {})
    expect((await response.text()).replaceAll('<!-- -->', '')).toMatch(
      /Banana bread<\/span><span[^>]*>14 · /,
    )
    expect(await html('/fr')).toMatch(/Pain à la banane<\/span><span[^>]*>14 · /)
  })

  it('credits every image the site shows', async () => {
    const page = await html('/en/credits')
    expect(page.match(/<figure/g)?.length).toBeGreaterThanOrEqual(30)
    expect(page).toContain('Ries Bosch')
    expect(page).toContain('Georges Méliès, public domain, via')
  })

  it('serves the RSC payload for client-side navigation', async () => {
    const response = await get('/en/recipes_.rsc')
    expect(response.headers.get('content-type')).toContain('text/x-component')
    expect(await response.text()).toContain('Banana pancakes')
  })

  it('sends the whole page without scripts in no-JS mode', async () => {
    const page = await html('/en?__nojs')
    // the categories stream in on their own, and are there already
    expect(page).toContain('Workers Leaving the Lumière Factory')
    expect(page).not.toContain('<script')
  })

  it('logs each request once its response is ready', async () => {
    await get('/en/movies', { 'x-trace-id': 'e2e-trace' })
    const end = logLines(server.output()).find(
      (line) => line.traceId === 'e2e-trace' && line.message === 'end',
    )
    expect(end).toMatchObject({
      level: 'info',
      labels: ['Request'],
      request: { method: 'GET', path: '/en/movies' },
      status: 200,
      auth: { type: 'guest' },
    })
    expect(end?.durationMs).toBeTypeOf('number')
  })

  it('gates /manage behind a login with a user and password, and logs out', async () => {
    // a page without a session goes to the login page, which comes back to it after
    const gate = await get('/manage/e/post')
    expect(gate.status).toBe(307)
    expect(gate.headers.get('location')).toBe('/manage/login?next=%2Fmanage%2Fe%2Fpost')

    const loginUrl = `${server.url}/manage/login?next=%2Fmanage%2Fe%2Fpost`
    const loginPage = await html('/manage/login?next=%2Fmanage%2Fe%2Fpost')

    const wrong = await submitForm(loginUrl, loginPage, 'name="password"', {
      username: user.name,
      password: 'wrong',
    })
    expect(wrong.headers.get('set-cookie')).toBeNull()
    const wrongPage = await wrong.text()
    expect(wrongPage).toContain('Wrong username or password.')
    // the form keeps the username for the next try
    expect(wrongPage).toMatch(new RegExp(`name="username"[^>]*value="${user.name}"`))

    const login = await submitForm(loginUrl, loginPage, 'name="password"', {
      username: user.name,
      password: user.password,
    })
    expect(login.status).toBe(303)
    expect(login.headers.get('location')).toBe('/manage/e/post')
    const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
    expect(cookie).toMatch(/^auth=[0-9a-f-]{36}$/)

    // the session opens the admin, with the user in its bar and the seed's posts
    const dashboard = await html('/manage', { cookie })
    expect(dashboard).toContain('Dashboard')
    expect(dashboard).toContain(`>${user.name}</a>`)
    expect(await html('/manage/e/post', { cookie })).toContain('Banana pancakes')

    // and it stays out of the page data, which React's dev build fills with props
    const payload = await html('/manage_.rsc', { cookie })
    expect(payload).toContain('Dashboard')
    expect(payload).not.toContain(cookie.slice('auth='.length))

    const logout = await submitForm(`${server.url}/manage`, dashboard, 'Logout', {}, cookie)
    expect(logout.status).toBe(303)
    expect(logout.headers.get('location')).toBe('/manage/login?next=%2Fmanage')
    expect(logout.headers.get('set-cookie')).toMatch(/^auth=; Path=\/; Max-Age=0/)
    expect((await get('/manage', { cookie })).status).toBe(307)
  })
})

describe('bananacms build + start', () => {
  const dataPath = mkdtempSync(join(tmpdir(), 'bananacms-e2e-'))
  let server: Awaited<ReturnType<typeof startServer>>
  const html = async (path: string) => (await fetch(server.url + path)).text()

  beforeAll(async () => {
    await seedDemo(dataPath)
    await runCli(['build'], dataPath)
    server = await startServer('start', dataPath)
  })

  afterAll(() => {
    server?.stop()
    rmSync(dataPath, { recursive: true, force: true })
  })

  it('serves the built site', async () => {
    expect(await html('/en/recipes')).toContain('Banana pancakes')
    expect((await fetch(`${server.url}/a/b/c/d`)).status).toBe(404)
  })

  it('serves the sitemap, with each page in each language', async () => {
    const response = await fetch(`${server.url}/sitemap.xml`)
    expect(response.headers.get('content-type')).toBe('application/xml')
    const sitemap = await response.text()
    expect(sitemap).toContain(`<loc>${server.url}/en/recipes/banana-bread</loc>`)
    expect(sitemap).toContain(`<loc>${server.url}/es/movies/nosferatu</loc>`)
    expect(sitemap).not.toContain('ratatouille')
  })

  it('sends /manage to the login page without a session', async () => {
    const response = await fetch(`${server.url}/manage`, { redirect: 'manual' })
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('/manage/login?next=%2Fmanage')
  })

  const stylesheets = async (path: string) =>
    [...(await html(path)).matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(
      (match) => match[1],
    )

  it("keeps the site's and the admin's stylesheets apart", async () => {
    const site = await stylesheets('/en')
    const admin = await stylesheets('/manage')
    expect(site.length).toBeGreaterThan(0)
    expect(admin.length).toBeGreaterThan(0)
    expect(site.filter((href) => admin.includes(href))).toEqual([])
  })

  it('serves CSS modules compiled from Sass, with mixins from an @app/ path', async () => {
    const page = await html('/en')
    const frame = /<section class="([\w-]+_frame)"/.exec(page)?.[1]
    expect(frame).toBeDefined()
    const hrefs = [...new Set(page.match(/\/assets\/[\w-]+\.css/g))]
    const css = (
      await Promise.all(hrefs.map(async (href) => (await fetch(server.url + href)).text()))
    ).join('\n')
    // the card mixin from src/styles/mixins.scss
    expect(css).toMatch(new RegExp(`\\.${frame}\\{[^}]*border-radius:1rem`))
  })

  it('serves its font from the site itself', async () => {
    const hrefs = [...new Set((await html('/en')).match(/\/assets\/[\w-]+\.css/g))]
    const css = (
      await Promise.all(hrefs.map(async (href) => (await fetch(server.url + href)).text()))
    ).join('\n')
    expect(css).toMatch(/font-family:\s*["']?Noto Sans Display Variable/)
    const file = /url\("?(\/assets\/noto-sans-display-latin-wdth-normal-[\w-]+\.woff2)"?\)/.exec(
      css,
    )?.[1]
    expect(file).toBeDefined()
    const font = await fetch(server.url + file)
    expect(font.status).toBe(200)
    expect(font.headers.get('content-type')).toBe('font/woff2')
  })
})
