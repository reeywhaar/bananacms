import { open, type FileHandle } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { getRequest, getUrl } from '../framework/context.ts'
import type { Middleware } from '../framework/middleware.ts'

// An image variant already in ASSETS_DIRECTORY, served from its file ahead of the
// rest of the middleware: no database, and no session. Variant URLs are
// content-addressed. /d/<id>/<hash> is the file <id>-<hash>, which assetDelivery
// writes on the variant's first request, and the admin removes when the asset's
// image settings change, which give it a new hash.
//
// The file's first bytes tell its type, since the database, which knows it, is
// left out. A variant not encoded yet, or a file of another type, goes on to
// assetDelivery.
export const assetFastPath: Middleware = async (ctx, next) => {
  const { method } = getRequest(ctx)
  const assetsDir = process.env.ASSETS_DIRECTORY
  // hex and dashes only, so no URL can reach a file outside the directory
  const match = /^\/d\/([0-9a-f-]{1,64})\/([0-9a-f]{1,64})\/?$/i.exec(getUrl(ctx).pathname)
  if (!match || !assetsDir || (method !== 'GET' && method !== 'HEAD')) return next()
  const [, id, hash] = match
  return (await serveFile(join(assetsDir, `${id}-${hash}`), method === 'HEAD')) ?? next()
}

async function serveFile(path: string, headOnly: boolean): Promise<Response | undefined> {
  let file: FileHandle
  try {
    file = await open(path, 'r')
  } catch {
    return undefined
  }
  try {
    const stat = await file.stat()
    const head = Buffer.alloc(SNIFF_BYTES)
    const { bytesRead } = stat.isFile()
      ? await file.read(head, 0, SNIFF_BYTES, 0)
      : { bytesRead: 0 }
    const type = imageType(head.subarray(0, bytesRead))
    if (!stat.isFile() || !type) {
      await file.close()
      return undefined
    }
    const headers = {
      'Content-Type': type,
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
    }
    if (headOnly) {
      await file.close()
      return new Response(null, { headers })
    }
    // the stream closes the file once it has been read, or cancelled
    return new Response(Readable.toWeb(file.createReadStream({ start: 0 })) as ReadableStream, {
      headers,
    })
  } catch (error) {
    await file.close().catch(() => {})
    throw error
  }
}

const SNIFF_BYTES = 64
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

// The types variants are encoded as, and SVG, which a variant of an SVG original
// links to
export function imageType(head: Buffer): string | undefined {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return 'image/jpeg'
  }
  if (head.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png'
  const start = head.subarray(0, 6).toString('latin1')
  if (start === 'GIF87a' || start === 'GIF89a') return 'image/gif'
  if (
    head.subarray(0, 4).toString('latin1') === 'RIFF' &&
    head.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp'
  }
  if (head.subarray(4, 8).toString('latin1') === 'ftyp') {
    return head.subarray(8, 11).toString('latin1') === 'avi' ? 'image/avif' : undefined
  }
  if (head.toString('utf8').replace(/^﻿/, '').trimStart().startsWith('<')) {
    return 'image/svg+xml'
  }
  return undefined
}
