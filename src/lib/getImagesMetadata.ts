import { join } from 'node:path'
import { access, mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { getServices } from '@cms/services/getServices'
import { AssetStore, AssetResolution } from '@cms/services/AssetStore'

const resFactor: Record<AssetResolution, number> = { '@1x': 1, '@2x': 2, '@3x': 3 }

export type ImageLayout = { width: number; height: number }

const fileExists = (p: string) =>
  access(p)
    .then(() => true)
    .catch(() => false)

export const getImagesMetadata = async (ids: string[]): Promise<Record<string, ImageLayout>> => {
  const dir = process.env.ASSETS_DIRECTORY
  if (!dir) return {}
  await mkdir(dir, { recursive: true })

  const { db } = await getServices()
  const store = new AssetStore(db)
  const contents = await store.getContent(ids)

  const entries = await Promise.all(
    ids.map(async (id): Promise<[string, ImageLayout] | null> => {
      const path = join(dir, id)
      if (!(await fileExists(path))) {
        const asset = await store.get(id)
        if (!asset) return null
        await writeFile(path, asset.data)
      }
      const meta = await sharp(path).metadata()
      const w = meta.autoOrient?.width ?? meta.width
      const h = meta.autoOrient?.height ?? meta.height
      if (!w || !h) return null

      const content = contents[id]
      const sourceRes: AssetResolution = content?.resolution ?? '@1x'
      const maxSize = content?.maxSize
      const k = maxSize ? Math.min(maxSize.width / w, maxSize.height / h, 1) : 1
      const boundedW = w * k
      const boundedH = h * k
      const factor = resFactor[sourceRes]
      return [
        id,
        {
          width: Math.max(1, Math.round(boundedW / factor)),
          height: Math.max(1, Math.round(boundedH / factor)),
        },
      ]
    }),
  )
  return Object.fromEntries(entries.filter((e): e is [string, ImageLayout] => e !== null))
}
