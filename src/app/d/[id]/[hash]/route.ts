import { NextRequest, NextResponse } from 'next/server'
import { createReadStream } from 'fs'
import { access, lstat, mkdir, readFile, rename, symlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { Readable } from 'stream'
import { randomBytes } from 'crypto'
import { getServices } from '@cms/services/getServices'
import { AssetStore, AssetOutputFormat, AssetResolution } from '@cms/services/AssetStore'
import { assetVariantHash } from '@cms/lib/assetHash'
import { optimizeImage } from '@cms/lib/optimizeImage'
import { createRouteHandler } from '@cms/lib/routeHandler'

export const GET = createRouteHandler<{ params: Promise<{ id: string; hash: string }> }>(
  async (req: NextRequest, { params }) => {
    const { id, hash } = await params
    const url = new URL(req.url)
    const res = url.searchParams.get('res')

    const services = await getServices()
    const log = services.rootLogger.child('Asset', { assetId: id, hash, res })

    if (!isResolution(res)) return new NextResponse(null, { status: 400 })

    const assetsDir = process.env.ASSETS_DIRECTORY
    if (!assetsDir) return new NextResponse(null, { status: 500 })

    log.debug('lookup')

    const asset = await new AssetStore(services.db).get(id)
    if (!asset || !asset.mime.startsWith('image/')) {
      log.info('notFound')
      return new NextResponse(null, { status: 404 })
    }

    const imageContent = asset.content?.type === 'image' ? asset.content : null
    const outputAs: AssetOutputFormat = imageContent?.output_as ?? { type: 'original' }
    const sourceRes: AssetResolution = imageContent?.resolution ?? '@1x'
    const maxSize = imageContent?.maxSize

    const expected = assetVariantHash(id, outputAs, res, sourceRes, maxSize)
    if (expected !== hash) {
      log.warn('hashMismatch', { expected, got: hash })
      return new NextResponse(null, { status: 404 })
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
      const mime = isSymlink ? asset.mime : mimeFor(outputAs, asset.mime)
      log.debug('cache.hit', { cachePath, isSymlink })
      const stream = Readable.toWeb(createReadStream(cachePath)) as ReadableStream
      return new NextResponse(stream, {
        headers: {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }

    log.debug('cache.miss')

    const sourcePath = join(assetsDir, id)
    if (!(await fileExists(sourcePath))) {
      await writeFile(sourcePath, asset.data)
    }
    const sourceBuffer = await readFile(sourcePath)

    const { data, mime } = await optimizeImage(sourceBuffer, {
      sourceRes,
      targetRes: effectiveRes,
      format: outputAs,
      sourceMime: asset.mime,
      maxSize,
    })

    const tmpPath = `${cachePath}.tmp.${randomBytes(6).toString('hex')}`
    const sourceBytes = sourceBuffer.length
    const outBytes = data.length
    const ratio = sourceBytes > 0 ? outBytes / sourceBytes : 0
    const kept = outBytes < sourceBytes * 0.9
    const wasResized = !!maxSize || resFactor[effectiveRes] < resFactor[sourceRes]

    log.info('optimize.result', { sourceBytes, outBytes, ratio, kept, format: outputAs.type })

    if (!kept && !wasResized) {
      await symlink(id, tmpPath)
      await rename(tmpPath, cachePath).catch(() => {})
      return new NextResponse(new Uint8Array(sourceBuffer), {
        headers: {
          'Content-Type': asset.mime,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }

    await writeFile(tmpPath, data)
    await rename(tmpPath, cachePath).catch(() => {})
    log.debug('optimize.stored', { cachePath, outBytes })

    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  },
)

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
