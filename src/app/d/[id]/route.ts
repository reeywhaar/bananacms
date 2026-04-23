import { NextResponse } from 'next/server'
import { createReadStream } from 'fs'
import { access, mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { Readable } from 'stream'
import { getServices } from '@cms/services/getServices'
import { AssetStore } from '@cms/services/AssetStore'
import { createRouteHandler } from '@cms/lib/routeHandler'

export const GET = createRouteHandler<{ params: Promise<{ id: string }> }>(
  async (_req, { params }) => {
    const { id } = await params

    const assetsDir = process.env.ASSETS_DIRECTORY
    const { db } = await getServices()
    if (assetsDir) {
      const cachePath = join(assetsDir, id)
      const cacheHit = await access(cachePath)
        .then(() => true)
        .catch(() => false)

      if (cacheHit) {
        const asset = await new AssetStore(db).get(id)
        if (!asset) return new NextResponse(null, { status: 404 })

        const stream = Readable.toWeb(createReadStream(cachePath)) as ReadableStream
        return new NextResponse(stream, {
          headers: {
            'Content-Type': asset.mime,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        })
      }
    }

    const asset = await new AssetStore(db).get(id)
    if (!asset) return new NextResponse(null, { status: 404 })

    if (assetsDir) {
      await mkdir(assetsDir, { recursive: true })
      await writeFile(join(assetsDir, id), asset.data).catch(() => {
        // cache write failure is non-fatal; continue serving from DB
      })
    }

    return new NextResponse(new Uint8Array(asset.data), {
      headers: {
        'Content-Type': asset.mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  },
)
