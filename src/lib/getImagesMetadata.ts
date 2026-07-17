import { join } from 'node:path'
import { access, mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { getServices } from '@cms/services/getServices'
import { AssetStore, AssetResolution, type AssetImageContent } from '@cms/services/AssetStore'

const resFactor: Record<AssetResolution, number> = { '@1x': 1, '@2x': 2, '@3x': 3 }

export type ImageLayout = { width: number; height: number }

/**
 * Pure transform from persisted asset content to display dimensions.
 * Consumers that already hold a `getContent()` result can derive dimensions
 * from it directly instead of paying a second content scan through
 * getImagesMetadata() (or duplicating this math and drifting from it).
 * Returns null when the content predates persisted width/height —
 * getImagesMetadata() covers those with a sharp probe of the cached file.
 */
export const imageDimensionsFromContent = (
  content: AssetImageContent | undefined,
): ImageLayout | null => {
  if (!content?.width || !content.height) return null
  return scaleDimensions(content, { w: content.width, h: content.height })
}

/** Batch form of imageDimensionsFromContent; ids without dimensions are omitted. */
export const imageMetadataFromContents = (
  contents: Record<string, AssetImageContent>,
): Record<string, ImageLayout> => {
  const result: Record<string, ImageLayout> = {}
  for (const [id, content] of Object.entries(contents)) {
    const layout = imageDimensionsFromContent(content)
    if (layout) result[id] = layout
  }
  return result
}

const scaleDimensions = (
  content: AssetImageContent | undefined,
  { w, h }: { w: number; h: number },
): ImageLayout => {
  const sourceRes: AssetResolution = content?.resolution ?? '@1x'
  const maxSize = content?.maxSize
  const k = maxSize ? Math.min(maxSize.width / w, maxSize.height / h, 1) : 1
  const factor = resFactor[sourceRes]
  return {
    width: Math.max(1, Math.round((w * k) / factor)),
    height: Math.max(1, Math.round((h * k) / factor)),
  }
}

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
      const fromContent = imageDimensionsFromContent(content)
      if (fromContent) return [id, fromContent]
      const dims = await probeDimensions(id, store)
      return dims ? [id, scaleDimensions(content, dims)] : null
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
  // Persist the probe so later renders read dimensions straight from content
  // instead of re-running sharp on every request for this asset.
  await store.updateContent(id, { width: w, height: h })
  return { w, h }
}
