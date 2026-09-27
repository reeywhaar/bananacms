import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { BUILD_ASSETS_DIR, clientFilesMiddleware } from './client_files.ts'

describe('clientFilesMiddleware', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bananacms-client-files-'))
  mkdirSync(join(dir, BUILD_ASSETS_DIR), { recursive: true })
  writeFileSync(join(dir, BUILD_ASSETS_DIR, 'index-D_lyxYjy.js'), 'export {}')
  writeFileSync(join(dir, 'assets', 'logo.png'), 'png')
  writeFileSync(join(dir, 'robots.txt'), 'User-agent: *')
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  const middleware = clientFilesMiddleware(dir)
  const get = (path: string) =>
    middleware(new Request('http://localhost' + path), () => new Response('the app'))

  it("serves the build's hashed files to be kept for a year", async () => {
    const response = await get(`/${BUILD_ASSETS_DIR}/index-D_lyxYjy.js`)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('max-age=31536000, immutable')
  })

  it("serves a site's public files, whose names stay, to be checked each time", async () => {
    for (const path of ['/robots.txt', '/assets/logo.png']) {
      const response = await get(path)
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBeNull()
      expect(response.headers.get('etag')).toBeTruthy()
    }
  })

  it('passes a request for a file there is none of to the app', async () => {
    const response = await get(`/${BUILD_ASSETS_DIR}/gone-Bx7a9c2Q.js`)
    expect(await response.text()).toBe('the app')
  })
})
