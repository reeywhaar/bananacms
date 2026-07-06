import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'
import { open, type FileHandle } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Plain-http fast path for asset delivery, sitting in front of the CMS zone.
 *
 * Variant URLs are content-addressed: /d/<id>/<hash> maps 1:1 to the file
 * ASSETS_DIRECTORY/<id>-<hash> that the /d/[id]/[hash] route materializes on
 * first encode and unlinks on change (changed assets get a new hash, so a new
 * URL). Serving that file directly costs no Next.js machinery, no middleware,
 * and no DB lookup — on a small host this keeps image bursts from starving
 * page SSR. Anything the file lookup can't answer (originals, cold variants,
 * legacy clamped-resolution URLs, non-GET) is proxied to the CMS zone, which
 * stays the only writer of the assets directory.
 */
export interface AssetServerOptions {
  /**
   * Directory holding original assets and encoded variants (ASSETS_DIRECTORY).
   * When unset the server degrades to a pure pass-through proxy.
   */
  assetsDir?: string
  /** CMS zone base URL; everything the file fast path can't answer goes here. */
  upstreamUrl: string
  /** Public asset-delivery prefix (cms.paths.assetDelivery). */
  assetDeliveryPath?: string
}

export function createAssetServer(opts: AssetServerOptions): Server {
  const prefix = (opts.assetDeliveryPath ?? '/d').replace(/\/+$/, '')
  return createServer((req, res) => {
    handle(req, res, prefix, opts).catch(() => {
      if (!res.headersSent) res.writeHead(500)
      res.end()
    })
  })
}

export function startAssetServer(port: number, opts: AssetServerOptions): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createAssetServer(opts)
    server.on('error', (err) => {
      if (server.listening) {
        console.error('assets: server error', err)
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
  opts: AssetServerOptions,
): Promise<void> {
  if (opts.assetsDir && (req.method === 'GET' || req.method === 'HEAD')) {
    const pathname = new URL(req.url ?? '/', 'http://assets.internal').pathname
    const filename = matchVariantFilename(pathname, prefix)
    if (filename && (await serveFile(req, res, join(opts.assetsDir, filename)))) return
  }
  proxyToUpstream(req, res, opts.upstreamUrl)
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

/** Returns false when the request should fall through to the CMS zone. */
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
    res.end('asset server: upstream unavailable')
  })
  res.on('close', () => upstream.destroy())
  req.pipe(upstream)
}
