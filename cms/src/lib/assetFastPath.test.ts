import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestContext } from '../test/context.ts'
import { assetFastPath, imageType } from './assetFastPath.ts'

const ID = '01a0d75d-70c6-75de-bf9b-e42213d15194'
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('the rest of a png'),
])

let assetsDir: string
beforeEach(() => {
  assetsDir = mkdtempSync(join(tmpdir(), 'bananacms-assets-'))
  vi.stubEnv('ASSETS_DIRECTORY', assetsDir)
})
afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(assetsDir, { recursive: true, force: true })
})

// A request through the fast path, with no databases in its ctx, so a query
// would throw
async function run(path: string, method = 'GET') {
  const { ctx } = createTestContext({ url: `http://site.test${path}`, method })
  const next = vi.fn(async () => new Response('the rest of the middleware'))
  return { response: await assetFastPath(ctx, next), next }
}

describe('assetFastPath', () => {
  it('serves an encoded variant from its file', async () => {
    writeFileSync(join(assetsDir, `${ID}-6b0f3c2a9d1e`), PNG)
    const { response, next } = await run(`/d/${ID}/6b0f3c2a9d1e?res=@2x`)
    expect(next).not.toHaveBeenCalled()
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('content-length')).toBe(String(PNG.length))
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(Buffer.from(await response.arrayBuffer())).toEqual(PNG)
  })

  it('answers HEAD without the body', async () => {
    writeFileSync(join(assetsDir, `${ID}-6b0f3c2a9d1e`), PNG)
    const { response } = await run(`/d/${ID}/6b0f3c2a9d1e`, 'HEAD')
    expect(response.headers.get('content-length')).toBe(String(PNG.length))
    expect(response.body).toBeNull()
  })

  it("serves a variant that links to its original with the original's type", async () => {
    writeFileSync(join(assetsDir, ID), '<svg xmlns="http://www.w3.org/2000/svg"/>')
    symlinkSync(join(assetsDir, ID), join(assetsDir, `${ID}-6b0f3c2a9d1e`))
    const { response } = await run(`/d/${ID}/6b0f3c2a9d1e`)
    expect(response.headers.get('content-type')).toBe('image/svg+xml')
  })

  it('leaves the rest to assetDelivery: variants not encoded yet, other types, originals, other methods', async () => {
    writeFileSync(join(assetsDir, `${ID}-000000000000`), 'not an image')
    writeFileSync(join(assetsDir, `${ID}-6b0f3c2a9d1e`), PNG)
    for (const [path, method] of [
      [`/d/${ID}/aaaaaaaaaaaa`, 'GET'],
      [`/d/${ID}/000000000000`, 'GET'],
      [`/d/${ID}`, 'GET'],
      [`/d/${ID}/6b0f3c2a9d1e`, 'POST'],
    ]) {
      const { response, next } = await run(path, method)
      expect(next, `${method} ${path}`).toHaveBeenCalledOnce()
      expect(await response.text()).toBe('the rest of the middleware')
    }
  })

  it('takes only hex and dashes from the URL, so it stays inside ASSETS_DIRECTORY', async () => {
    for (const path of [`/d/..%2F..%2Fetc/passwd`, `/d/${ID}/..%2Fsecret`, '/d/a.b/6b0f3c2a9d1e']) {
      const { next } = await run(path)
      expect(next, path).toHaveBeenCalledOnce()
    }
  })

  it('leaves everything to assetDelivery without an ASSETS_DIRECTORY', async () => {
    writeFileSync(join(assetsDir, `${ID}-6b0f3c2a9d1e`), PNG)
    vi.stubEnv('ASSETS_DIRECTORY', '')
    const { next } = await run(`/d/${ID}/6b0f3c2a9d1e`)
    expect(next).toHaveBeenCalledOnce()
  })
})

describe('imageType', () => {
  it('knows the types variants are encoded as by their first bytes', () => {
    expect(imageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(imageType(PNG)).toBe('image/png')
    expect(imageType(Buffer.from('GIF89a...'))).toBe('image/gif')
    expect(imageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp')
    expect(imageType(Buffer.from('\0\0\0\x1cftypavif'))).toBe('image/avif')
    expect(imageType(Buffer.from('﻿  <?xml version="1.0"?><svg/>'))).toBe('image/svg+xml')
    expect(imageType(Buffer.from('\0\0\0\x1cftypmp42'))).toBeUndefined()
    expect(imageType(Buffer.from('BM'))).toBeUndefined()
  })
})
