import { NextRequest, NextResponse } from 'next/server'
import { createReadStream } from 'fs'
import { access, mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { Readable } from 'stream'
import { getServices } from '@cms/services/getServices'
import { AssetStore } from '@cms/services/AssetStore'
import { createRouteHandler } from '@cms/lib/routeHandler'
import { rangeResponse } from '@cms/lib/rangeResponse'

export const GET = createRouteHandler<{ params: Promise<{ id: string }> }>(
  async (req: NextRequest, { params }) => {
    const { id } = await params
    const range = req.headers.get('range')

    const assetsDir = process.env.ASSETS_DIRECTORY
    const { db } = await getServices()
    const store = new AssetStore(db)

    if (assetsDir) {
      const cachePath = join(assetsDir, id)
      const cacheHit = await access(cachePath)
        .then(() => true)
        .catch(() => false)

      if (cacheHit) {
        const meta = await store.getMeta(id)
        if (!meta) return new NextResponse(null, { status: 404 })

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
    if (!asset) return new NextResponse(null, { status: 404 })

    if (assetsDir) {
      await mkdir(assetsDir, { recursive: true })
      await writeFile(join(assetsDir, id), asset.data).catch(() => {
        // cache write failure is non-fatal; continue serving from the DB buffer
      })
    }

    return rangeResponse({
      range,
      size: asset.data.length,
      headers: assetHeaders(asset.mime, asset.filename),
      body: (start, end) => new Uint8Array(asset.data.subarray(start, end + 1)),
    })
  },
)

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
