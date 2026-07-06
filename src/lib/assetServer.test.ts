import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startAssetServer } from './assetServer.ts'

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('jpeg-body')])
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('png-body'),
])
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x0c, 0x00, 0x00, 0x00]),
  Buffer.from('WEBPwebp-body'),
])

const ID = '019d89d8-9bfb-722c-879e-1e39824a57ec'
const HASH = '349edd0391a2'

describe('assetServer', () => {
  let assetsDir: string
  let upstream: Server
  let upstreamSeen: string[]
  let server: Server
  let base: string

  beforeAll(async () => {
    assetsDir = mkdtempSync(join(tmpdir(), 'bananacms-assets-test-'))
    writeFileSync(join(assetsDir, `${ID}-${HASH}`), JPEG)
    writeFileSync(join(assetsDir, ID), PNG)
    symlinkSync(ID, join(assetsDir, `${ID}-aaaaaaaaaaaa`))
    writeFileSync(join(assetsDir, `${ID}-bbbbbbbbbbbb`), Buffer.from('not an image'))
    writeFileSync(join(assetsDir, `${ID}-cccccccccccc`), WEBP)

    upstreamSeen = []
    upstream = createServer((req, res) => {
      upstreamSeen.push(`${req.method} ${req.url}`)
      res.writeHead(200, { 'Content-Type': 'text/plain', 'X-Upstream': '1' })
      res.end('from-upstream')
    })
    await new Promise<void>((resolve) => upstream.listen(0, resolve))
    const upstreamPort = (upstream.address() as AddressInfo).port

    server = await startAssetServer(0, {
      assetsDir,
      upstreamUrl: `http://localhost:${upstreamPort}`,
    })
    base = `http://localhost:${(server.address() as AddressInfo).port}`
  })

  afterAll(() => {
    server.close()
    upstream.close()
    rmSync(assetsDir, { recursive: true, force: true })
  })

  it('serves an existing variant file with sniffed mime and immutable caching', async () => {
    const res = await fetch(`${base}/d/${ID}/${HASH}?res=%401x`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(res.headers.get('content-length')).toBe(String(JPEG.length))
    expect(Buffer.from(await res.arrayBuffer())).toEqual(JPEG)
    expect(upstreamSeen).toEqual([])
  })

  it('answers HEAD without a body', async () => {
    const res = await fetch(`${base}/d/${ID}/${HASH}`, { method: 'HEAD' })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-length')).toBe(String(JPEG.length))
    expect((await res.arrayBuffer()).byteLength).toBe(0)
    expect(upstreamSeen).toEqual([])
  })

  it('follows variant symlinks to the original and sniffs its mime', async () => {
    const res = await fetch(`${base}/d/${ID}/aaaaaaaaaaaa`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PNG)
  })

  it('sniffs webp', async () => {
    const res = await fetch(`${base}/d/${ID}/cccccccccccc`)
    expect(res.headers.get('content-type')).toBe('image/webp')
  })

  it('proxies variant misses to the upstream', async () => {
    const res = await fetch(`${base}/d/${ID}/000000000000?res=%401x`)
    expect(res.headers.get('x-upstream')).toBe('1')
    expect(await res.text()).toBe('from-upstream')
    expect(upstreamSeen).toContain(`GET /d/${ID}/000000000000?res=%401x`)
  })

  it('proxies files with unrecognized bytes so the CMS route answers with the DB mime', async () => {
    const res = await fetch(`${base}/d/${ID}/bbbbbbbbbbbb`)
    expect(res.headers.get('x-upstream')).toBe('1')
  })

  it('proxies original-asset URLs (no hash segment)', async () => {
    const res = await fetch(`${base}/d/${ID}`)
    expect(res.headers.get('x-upstream')).toBe('1')
    expect(upstreamSeen).toContain(`GET /d/${ID}`)
  })

  it('proxies non-GET methods untouched', async () => {
    const res = await fetch(`${base}/d/${ID}/${HASH}`, { method: 'POST' })
    expect(res.headers.get('x-upstream')).toBe('1')
    expect(upstreamSeen).toContain(`POST /d/${ID}/${HASH}`)
  })

  it('never maps traversal or out-of-charset segments to the filesystem', async () => {
    // %2e%2e decodes to '..' — must not be treated as a filename.
    for (const path of [`/d/%2e%2e/%2e%2e`, `/d/${ID}/foo.txt`, `/d/..%2fsecret/${HASH}`]) {
      const res = await fetch(`${base}${path}`)
      expect(res.headers.get('x-upstream')).toBe('1')
    }
  })
})
