import { randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, lstat, mkdir, readFile, rename, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import type { Context } from '../framework/context.ts'
import type { Middleware } from '../framework/middleware.ts'
import { AssetStore, type AssetOutputFormat, type AssetResolution } from '../services/AssetStore.ts'
import { singleflight } from '../utils/singleflight.ts'
import { assetVariantHash } from './assetHash.ts'
import { optimizeImage } from './optimizeImage.ts'
import { rangeResponse } from './rangeResponse.ts'
import { getDb, getLogger, getRequest, getUrl } from '../framework/context.ts'

// Serves assets: /d/:id is the file as uploaded, with range requests, and
// /d/:id/:hash?res=@2x an image variant, encoded on its first request (getAssetUrl.ts
// makes both URLs). ASSETS_DIRECTORY caches the files; the originals live in the
// database too.
export const assetDelivery: Middleware = async (ctx, next) => {
  const match = /^\/d\/([\w-]+)(?:\/([0-9a-f]+))?\/?$/.exec(getUrl(ctx).pathname)
  if (!match || getRequest(ctx).method !== 'GET') return next()
  const [, id, hash] = match
  return hash ? serveVariant(ctx, id, hash) : serveOriginal(ctx, id)
}

async function serveOriginal(ctx: Context, id: string): Promise<Response> {
  const range = getRequest(ctx).headers.get('range')
  const assetsDir = process.env.ASSETS_DIRECTORY
  const store = new AssetStore(getDb(ctx))

  if (assetsDir) {
    const cachePath = join(assetsDir, id)
    if (await fileExists(cachePath)) {
      const meta = await store.getMeta(id)
      if (!meta) return new Response(null, { status: 404 })

      return rangeResponse({
        range,
        size: meta.size,
        headers: assetHeaders(meta.mime, meta.filename),
        body: (start, end) =>
          Readable.toWeb(createReadStream(cachePath, { start, end })) as ReadableStream,
      })
    }
  }

  const asset = await store.get(id)
  if (!asset) return new Response(null, { status: 404 })

  if (assetsDir) {
    await mkdir(assetsDir, { recursive: true })
    await writeFile(join(assetsDir, id), asset.data).catch(() => {
      // a failed cache write still serves the file, from the database's copy
    })
  }

  return rangeResponse({
    range,
    size: asset.data.length,
    headers: assetHeaders(asset.mime, asset.filename),
    body: (start, end) => new Uint8Array(asset.data.subarray(start, end + 1)),
  })
}

async function serveVariant(ctx: Context, id: string, hash: string): Promise<Response> {
  const res = getUrl(ctx).searchParams.get('res')
  const log = getLogger(ctx).child('Asset', { assetId: id, hash, res })

  if (!isResolution(res)) return new Response(null, { status: 400 })

  // dev and start refuse to run without it
  const assetsDir = process.env.ASSETS_DIRECTORY
  if (!assetsDir) throw new Error('ASSETS_DIRECTORY is not set: image variants are made there')

  log.debug('lookup')

  const store = new AssetStore(getDb(ctx))
  const meta = await store.getMeta(id)
  if (!meta || !meta.mime.startsWith('image/')) {
    log.info('notFound')
    return new Response(null, { status: 404 })
  }

  const imageContent = meta.content?.type === 'image' ? meta.content : null
  const outputAs: AssetOutputFormat = imageContent?.output_as ?? { type: 'original' }
  const sourceRes: AssetResolution = imageContent?.resolution ?? '@1x'
  const maxSize = imageContent?.maxSize

  const expected = assetVariantHash(id, outputAs, res, sourceRes, maxSize)
  if (expected !== hash) {
    log.warn('hashMismatch', { expected, got: hash })
    return new Response(null, { status: 404 })
  }

  const effectiveRes: AssetResolution = resFactor[res] > resFactor[sourceRes] ? sourceRes : res
  const effectiveHash =
    effectiveRes === res ? hash : assetVariantHash(id, outputAs, effectiveRes, sourceRes, maxSize)
  if (effectiveRes !== res) {
    log.debug('resolutionClamped', { from: res, to: effectiveRes })
  }

  await mkdir(assetsDir, { recursive: true })
  const cachePath = join(assetsDir, `${id}-${effectiveHash}`)

  if (await fileExists(cachePath)) {
    const stat = await lstat(cachePath)
    const isSymlink = stat.isSymbolicLink()
    const mime = isSymlink ? meta.mime : mimeFor(outputAs, meta.mime)
    log.debug('cache.hit', { cachePath, isSymlink })
    const stream = Readable.toWeb(createReadStream(cachePath)) as ReadableStream
    return new Response(stream, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }

  log.debug('cache.miss')

  // Coalesce concurrent misses for the same variant: the first request fetches
  // the source and runs the sharp encode, the rest await its result instead of
  // each starting their own.
  const result = await singleflight(`asset-variant:${cachePath}`, async () => {
    const sourcePath = join(assetsDir, id)
    let sourceBuffer: Buffer
    if (await fileExists(sourcePath)) {
      sourceBuffer = await readFile(sourcePath)
    } else {
      const blob = await store.getData(id)
      if (!blob) return null
      sourceBuffer = blob
      await writeFile(sourcePath, sourceBuffer)
    }

    const { data, mime } = await optimizeImage(sourceBuffer, {
      sourceRes,
      targetRes: effectiveRes,
      format: outputAs,
      sourceMime: meta.mime,
      maxSize,
    })

    const tmpPath = `${cachePath}.tmp.${randomBytes(6).toString('hex')}`
    const sourceBytes = sourceBuffer.length
    const outBytes = data.length
    const ratio = sourceBytes > 0 ? outBytes / sourceBytes : 0
    const kept = outBytes < sourceBytes * 0.9
    const wasResized = !!maxSize || resFactor[effectiveRes] < resFactor[sourceRes]

    log.info('optimize.result', { sourceBytes, outBytes, ratio, kept, format: outputAs.type })

    // an encode that saves little serves the original, through a symlink
    if (!kept && !wasResized) {
      await symlink(id, tmpPath)
      await rename(tmpPath, cachePath).catch(() => {})
      return { body: sourceBuffer, mime: meta.mime }
    }

    await writeFile(tmpPath, data)
    await rename(tmpPath, cachePath).catch(() => {})
    log.debug('optimize.stored', { cachePath, outBytes })
    return { body: data, mime }
  })

  if (!result) {
    log.info('notFound')
    return new Response(null, { status: 404 })
  }

  return new Response(new Uint8Array(result.body), {
    headers: {
      'Content-Type': result.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

const assetHeaders = (mime: string, filename: string): Record<string, string> => ({
  'Content-Type': mime,
  'Content-Disposition': contentDisposition(filename),
  'Cache-Control': 'public, max-age=31536000, immutable',
})

const contentDisposition = (filename: string): string => {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  const encoded = encodeURIComponent(filename)
  return `inline; filename="${ascii}"; filename*=UTF-8''${encoded}`
}

const resFactor: Record<AssetResolution, number> = { '@1x': 1, '@2x': 2, '@3x': 3 }

const isResolution = (v: string | null): v is AssetResolution =>
  v === '@1x' || v === '@2x' || v === '@3x'

const mimeFor = (f: AssetOutputFormat, fallback: string): string => {
  switch (f.type) {
    case 'original':
      return fallback
    case 'jpeg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    case 'png8':
    case 'png24':
      return 'image/png'
  }
}

const fileExists = (p: string) =>
  access(p)
    .then(() => true)
    .catch(() => false)
