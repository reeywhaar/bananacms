import { createServer, type Server } from 'node:http'
import { connect, type AddressInfo } from 'node:net'
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startFrontServer, type FrontServerRequestLog } from './frontServer.ts'

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

describe('frontServer', () => {
  let assetsDir: string
  let upstream: Server
  let upstreamSeen: string[]
  let server: Server
  let base: string
  let logged: FrontServerRequestLog[]

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

    logged = []
    server = await startFrontServer(0, {
      assetsDir,
      upstreamUrl: `http://localhost:${upstreamPort}`,
      onRequest: (entry) => logged.push(entry),
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

  it('reports hits, navigations and proxied requests via onRequest', async () => {
    logged.length = 0
    await fetch(`${base}/d/${ID}/${HASH}`)
    await fetch(`${base}/some/page`)
    expect(logged).toHaveLength(2)
    expect(logged[0]).toMatchObject({ kind: 'hit', method: 'GET', status: 200 })
    expect(logged[0].url).toBe(`/d/${ID}/${HASH}`)
    expect(logged[1]).toMatchObject({ kind: 'nav', method: 'GET', url: '/some/page' })
    expect(logged[1].ms).toBeGreaterThan(0)
  })

  it('classifies statics and asset fall-throughs as proxy, dot-less pages as nav', async () => {
    logged.length = 0
    await fetch(`${base}/_next/static/chunk.js`)
    await fetch(`${base}/styles.css`)
    await fetch(`${base}/d/${ID}`)
    await fetch(`${base}/`)
    await fetch(`${base}/blog/post`, { method: 'POST' })
    expect(logged.map((e) => e.kind)).toEqual(['proxy', 'proxy', 'proxy', 'nav', 'nav'])
  })

  it('proxies websocket upgrades to the upstream as raw TCP', async () => {
    upstream.on('upgrade', (req, socket) => {
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\nUpgrade: test\r\nConnection: Upgrade\r\n\r\n',
      )
      socket.write(`upgraded:${req.url}`)
    })
    const port = (server.address() as AddressInfo).port
    const received = await new Promise<string>((resolve, reject) => {
      const socket = connect(port, 'localhost', () => {
        socket.write(
          'GET /_next/hmr HTTP/1.1\r\nHost: x\r\nConnection: Upgrade\r\nUpgrade: test\r\n\r\n',
        )
      })
      let buffer = ''
      socket.on('data', (chunk) => {
        buffer += chunk.toString()
        if (buffer.includes('upgraded:')) {
          socket.destroy()
          resolve(buffer)
        }
      })
      socket.on('error', reject)
      setTimeout(() => reject(new Error('timed out waiting for upgrade')), 3000)
    })
    expect(received).toContain('101 Switching Protocols')
    expect(received).toContain('upgraded:/_next/hmr')
  })
})

describe('frontServer CMS routing', () => {
  let assetsDir: string
  let pub: Server
  let cms: Server
  let pubSeen: string[]
  let cmsSeen: string[]
  let server: Server
  let base: string

  const zoneServer = (name: string, seen: string[]) =>
    createServer((req, res) => {
      seen.push(`${req.method} ${req.url}`)
      res.writeHead(200, { 'X-Zone': name })
      res.end(name)
    })

  beforeAll(async () => {
    assetsDir = mkdtempSync(join(tmpdir(), 'bananacms-cms-route-'))
    writeFileSync(join(assetsDir, `${ID}-${HASH}`), JPEG)

    pubSeen = []
    cmsSeen = []
    pub = zoneServer('pub', pubSeen)
    cms = zoneServer('cms', cmsSeen)
    await new Promise<void>((resolve) => pub.listen(0, resolve))
    await new Promise<void>((resolve) => cms.listen(0, resolve))

    server = await startFrontServer(0, {
      assetsDir,
      upstreamUrl: `http://localhost:${(pub.address() as AddressInfo).port}`,
      cmsUpstreamUrl: `http://localhost:${(cms.address() as AddressInfo).port}`,
      cmsPaths: ['/manage', '/api', '/d', '/cms-static'],
      assetDeliveryPath: '/d',
    })
    base = `http://localhost:${(server.address() as AddressInfo).port}`
  })

  afterAll(() => {
    server.close()
    pub.close()
    cms.close()
    rmSync(assetsDir, { recursive: true, force: true })
  })

  const zoneOf = async (path: string, init?: RequestInit) =>
    (await fetch(`${base}${path}`, init)).headers.get('x-zone')

  it('routes CMS-owned prefixes straight to the CMS zone', async () => {
    expect(await zoneOf('/manage')).toBe('cms')
    expect(await zoneOf('/manage/e/tag')).toBe('cms')
    expect(await zoneOf('/api/posts')).toBe('cms')
    expect(await zoneOf('/cms-static/chunk.js')).toBe('cms')
    expect(pubSeen).toEqual([])
  })

  it('routes everything else to the pub zone', async () => {
    pubSeen.length = 0
    expect(await zoneOf('/')).toBe('pub')
    expect(await zoneOf('/blog/post')).toBe('pub')
    expect(await zoneOf('/_next/static/chunk.js')).toBe('pub')
    expect(cmsSeen.some((s) => s.includes('/blog/post'))).toBe(false)
  })

  it('does not match a prefix by string-prefix alone (/managed ≠ /manage)', async () => {
    expect(await zoneOf('/managed')).toBe('pub')
    expect(await zoneOf('/apix')).toBe('pub')
  })

  it('serves asset-variant hits from disk and falls through misses to the CMS zone', async () => {
    cmsSeen.length = 0
    pubSeen.length = 0
    const hit = await fetch(`${base}/d/${ID}/${HASH}`)
    expect(hit.headers.get('content-type')).toBe('image/jpeg')
    expect(cmsSeen).toEqual([])

    // A variant miss is a CMS-owned path, so it must fall through to the CMS
    // zone — never the pub zone.
    expect(await zoneOf(`/d/${ID}/000000000000`)).toBe('cms')
    expect(pubSeen).toEqual([])
  })
})
