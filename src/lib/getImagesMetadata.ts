import { join } from 'node:path'
import { access, mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { getServices } from '@cms/services/getServices'
import { AssetStore, AssetResolution } from '@cms/services/AssetStore'

const resFactor: Record<AssetResolution, number> = { '@1x': 1, '@2x': 2, '@3x': 3 }

export type ImageLayout = { width: number; height: number }

export const getImagesMetadata = async (ids: string[]): Promise<Record<string, ImageLayout>> => {
  if (ids.length === 0) return {}

  const { db } = await getServices()
  const store = new AssetStore(db)
  const contents = await store.getContent(ids)

  const entries = await Promise.all(
    ids.map(async (id): Promise<[string, ImageLayout] | null> => {
      const content = contents[id]
      // Dimensions are persisted into asset.content at upload time (both via
      // sharp autoOrient, so the values are interchangeable); probing the
      // cached file is only a fallback for assets predating that.
      const dims =
        content?.width && content?.height
          ? { w: content.width, h: content.height }
          : await probeDimensions(id, store)
      if (!dims) return null
      const { w, h } = dims

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

const fileExists = (p: string) =>
  access(p)
    .then(() => true)
    .catch(() => false)

const probeDimensions = async (
  id: string,
  store: AssetStore,
): Promise<{ w: number; h: number } | null> => {
  const dir = process.env.ASSETS_DIRECTORY
  if (!dir) return null
  await mkdir(dir, { recursive: true })

  const path = join(dir, id)
  if (!(await fileExists(path))) {
    const data = await store.getData(id)
    if (!data) return null
    await writeFile(path, data)
  }
  const meta = await sharp(path).metadata()
  const w = meta.autoOrient?.width ?? meta.width
  const h = meta.autoOrient?.height ?? meta.height
  if (!w || !h) return null
  return { w, h }
}
