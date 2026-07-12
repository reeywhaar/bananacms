import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'
import { connect } from 'node:net'
import type { Duplex } from 'node:stream'
import { open, type FileHandle } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Public front door (plain node:http): serves encoded asset variants straight
 * from disk, routes CMS-owned path prefixes (admin, api, asset delivery, asset
 * prefix) straight to the CMS zone, and passes everything else — pages,
 * statics, websocket upgrades — through to the consumer (pub) zone. Binding
 * this on the public port means no reverse-proxy setup is required to get the
 * fast path.
 *
 * CMS prefixes bypass the pub zone on purpose: the pub zone would only rewrite
 * them back out to the CMS zone (see cmsRewrites), so proxying them there
 * directly removes a full proxy hop from every admin page, API call, and asset
 * request. When `cmsUpstreamUrl`/`cmsPaths` are unset the server degrades to
 * the old behavior (everything to the pub zone, whose rewrites still reach the
 * CMS zone).
 *
 * Variant URLs are content-addressed: /d/<id>/<hash> maps 1:1 to the file
 * ASSETS_DIRECTORY/<id>-<hash> that the CMS zone's /d/[id]/[hash] route
 * materializes on first encode and unlinks on change (changed assets get a
 * new hash, so a new URL). Serving that file directly costs no Next.js
 * machinery, no middleware, and no DB lookup — on a small host this keeps
 * image bursts from starving page SSR. Anything the file lookup can't answer
 * (originals, cold variants, legacy clamped-resolution URLs, non-GET) falls
 * through to the CMS zone (asset delivery is a CMS prefix).
 */
export interface FrontServerOptions {
  /**
   * Directory holding original assets and encoded variants (ASSETS_DIRECTORY).
   * When unset the server degrades to a pure pass-through proxy.
   */
  assetsDir?: string
  /** Pub zone base URL; non-CMS requests the file fast path can't answer go here. */
  upstreamUrl: string
  /**
   * CMS zone base URL. Requests whose path matches one of `cmsPaths` are
   * proxied here directly, skipping the pub zone. Unset ⇒ everything goes to
   * `upstreamUrl` (previous behavior).
   */
  cmsUpstreamUrl?: string
  /**
   * CMS-owned path prefixes (admin, api, assetDelivery, assetPrefix) routed to
   * `cmsUpstreamUrl`. A path matches a prefix when it equals it or starts with
   * `${prefix}/`.
   */
  cmsPaths?: string[]
  /** Public asset-delivery prefix (cms.paths.assetDelivery). */
  assetDeliveryPath?: string
  /** Called once per completed request; the CLI routes this into the zone logs. */
  onRequest?: (entry: FrontServerRequestLog) => void
}

export interface FrontServerRequestLog {
  /**
   * 'hit' = served from the assets directory; 'nav' = page navigation passed
   * to the pub zone; 'proxy' = any other pass-through (statics, asset
   * fall-throughs). The zones can't time navigations themselves — middleware
   * `next()` returns before the RSC render — so the 'nav' `ms`, measured here
   * from request start to response finish, is the authoritative
   * per-navigation latency.
   */
  kind: 'hit' | 'proxy' | 'nav'
  method: string
  url: string
  status: number
  ms: number
}

export function createFrontServer(opts: FrontServerOptions): Server {
  const prefix = (opts.assetDeliveryPath ?? '/d').replace(/\/+$/, '')
  const server = createServer((req, res) => {
    handle(req, res, prefix, opts).catch(() => {
      if (!res.headersSent) res.writeHead(500)
      res.end()
    })
  })
  // Without this, upgrade requests (Next dev HMR websockets) are dropped.
  server.on('upgrade', (req, socket, head) => proxyUpgrade(req, socket, head, opts.upstreamUrl))
  return server
}

export function startFrontServer(port: number, opts: FrontServerOptions): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createFrontServer(opts)
    server.on('error', (err) => {
      if (server.listening) {
        console.error('front: server error', err)
      } else {
        reject(err)
      }
    })
    server.listen(port, () => resolve(server))
  })
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  prefix: string,
  opts: FrontServerOptions,
): Promise<void> {
  const pathname = new URL(req.url ?? '/', 'http://front.internal').pathname
  let kind: FrontServerRequestLog['kind'] = isNavigation(pathname, prefix) ? 'nav' : 'proxy'
  if (opts.onRequest) {
    const started = performance.now()
    res.once('finish', () => {
      opts.onRequest?.({
        kind,
        method: req.method ?? '-',
        url: req.url ?? '-',
        status: res.statusCode,
        ms: performance.now() - started,
      })
    })
  }
  if (opts.assetsDir && (req.method === 'GET' || req.method === 'HEAD')) {
    const filename = matchVariantFilename(pathname, prefix)
    if (filename && (await serveFile(req, res, join(opts.assetsDir, filename)))) {
      kind = 'hit'
      return
    }
  }
  // CMS-owned prefixes go straight to the CMS zone; the pub zone would only
  // rewrite them back there. Everything else (and any CMS path when routing
  // isn't configured) goes to the pub zone.
  const upstream =
    opts.cmsUpstreamUrl && matchesCmsPath(pathname, opts.cmsPaths)
      ? opts.cmsUpstreamUrl
      : opts.upstreamUrl
  proxyToUpstream(req, res, upstream)
}

function matchesCmsPath(pathname: string, prefixes: string[] | undefined): boolean {
  if (!prefixes) return false
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

// Dot-less paths outside Next internals and asset delivery are page
// navigations — the same convention as the middleware matcher's `.*\..*`
// file exclusion.
function isNavigation(pathname: string, prefix: string): boolean {
  if (pathname.includes('.')) return false
  if (pathname.startsWith('/_next')) return false
  return pathname !== prefix && !pathname.startsWith(`${prefix}/`)
}

// Hashes are 12 lowercase hex chars and ids are UUIDs, but accept the full
// hex-and-dash charset so the mapping never drifts from assetVariantHash.
// Rejecting everything else (., %, /) doubles as path-traversal protection:
// no accepted segment can escape the assets directory or collide with the
// extensionless source files (their names contain no dash-joined hash).
const VARIANT_SEGMENT_RE = /^[0-9a-f-]{1,64}$/i

function matchVariantFilename(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(`${prefix}/`)) return null
  const segments = pathname.slice(prefix.length + 1).split('/')
  if (segments.length !== 2) return null
  const [id, hash] = segments
  if (!VARIANT_SEGMENT_RE.test(id) || !VARIANT_SEGMENT_RE.test(hash)) return null
  return `${id}-${hash}`
}

/** Returns false when the request should fall through to the pub zone. */
async function serveFile(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
): Promise<boolean> {
  let file: FileHandle
  try {
    file = await open(path, 'r')
  } catch {
    return false
  }
  try {
    const stat = await file.stat()
    if (!stat.isFile()) {
      await file.close()
      return false
    }
    const head = Buffer.alloc(SNIFF_BYTES)
    const { bytesRead } = await file.read(head, 0, SNIFF_BYTES, 0)
    // Cache files are extensionless and the DB knows the real mime; sniffing
    // keeps the fast path DB-free. Unrecognized bytes fall through to the CMS
    // route rather than guessing.
    const mime = sniffImageMime(head.subarray(0, bytesRead))
    if (!mime) {
      await file.close()
      return false
    }
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
    })
    if (req.method === 'HEAD') {
      res.end()
      await file.close()
      return true
    }
    const stream = file.createReadStream({ start: 0 })
    stream.on('error', () => res.destroy())
    res.on('close', () => stream.destroy())
    stream.pipe(res)
    return true
  } catch (err) {
    await file.close().catch(() => {})
    throw err
  }
}

const SNIFF_BYTES = 64
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function sniffImageMime(head: Buffer): string | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return 'image/jpeg'
  }
  if (head.length >= 8 && head.subarray(0, 8).equals(PNG_MAGIC)) return 'image/png'
  const start6 = head.subarray(0, 6).toString('latin1')
  if (start6 === 'GIF87a' || start6 === 'GIF89a') return 'image/gif'
  if (
    head.length >= 12 &&
    head.subarray(0, 4).toString('latin1') === 'RIFF' &&
    head.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp'
  }
  if (head.length >= 12 && head.subarray(4, 8).toString('latin1') === 'ftyp') {
    if (head.subarray(8, 11).toString('latin1') === 'avi') return 'image/avif'
    return null
  }
  // Symlinked originals can be SVG (mime image/* is enforced at upload).
  const text = head
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .trimStart()
  if (text.startsWith('<')) return 'image/svg+xml'
  return null
}

// Standard hop-by-hop headers must not be forwarded on either leg.
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

function proxyToUpstream(req: IncomingMessage, res: ServerResponse, upstreamUrl: string): void {
  const target = new URL(req.url ?? '/', upstreamUrl)
  const headers: Record<string, string | string[]> = {}
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined && !HOP_BY_HOP.has(name)) headers[name] = value
  }
  const upstream = httpRequest(target, { method: req.method, headers }, (upstreamRes) => {
    const resHeaders: Record<string, string | string[]> = {}
    for (const [name, value] of Object.entries(upstreamRes.headers)) {
      if (value !== undefined && !HOP_BY_HOP.has(name)) resHeaders[name] = value
    }
    res.writeHead(upstreamRes.statusCode ?? 502, resHeaders)
    upstreamRes.pipe(res)
  })
  upstream.on('error', () => {
    if (res.headersSent) {
      res.destroy()
      return
    }
    res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end('front: upstream unavailable')
  })
  res.on('close', () => upstream.destroy())
  req.pipe(upstream)
}

/**
 * Splice an Upgrade request (websockets — e.g. Next dev HMR) through to the
 * upstream as raw TCP: replay the request head verbatim, then pipe bytes both
 * ways. rawHeaders preserves casing and duplicates.
 */
function proxyUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  upstreamUrl: string,
): void {
  const target = new URL(upstreamUrl)
  const upstream = connect(Number(target.port || 80), target.hostname, () => {
    let raw = `${req.method} ${req.url} HTTP/1.1\r\n`
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      raw += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`
    }
    upstream.write(`${raw}\r\n`)
    if (head.length) upstream.write(head)
    socket.pipe(upstream)
    upstream.pipe(socket)
  })
  const destroyBoth = () => {
    socket.destroy()
    upstream.destroy()
  }
  upstream.on('error', destroyBoth)
  socket.on('error', destroyBoth)
}
