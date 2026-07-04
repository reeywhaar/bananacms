'use server'

import { mkdir, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'
import { assetVariantFilenames } from '@cms/lib/assetHash'
import { getServices, requireAuth } from '@cms/services/getServices'
import {
  AssetStore,
  AssetContent,
  AssetContentUpdate,
  AssetOutputFormat,
  assetContentSchema,
  assetOutputFormatSchema,
} from '@cms/services/AssetStore'
import { v7 } from 'uuid'
import { createServerAction } from '@cms/lib/serverActions'

export const uploadAsset = createServerAction(
  async (formData: FormData): Promise<{ id: string }> => {
    await requireAuth()

    const file = formData.get('file')
    if (!(file instanceof File)) throw new Error('No file provided')

    const id = v7()
    const arrayBuffer = await file.arrayBuffer()
    const data = Buffer.from(arrayBuffer)

    const content: AssetContent = await (async () => {
      if (!file.type.startsWith('image/')) return { type: 'file' as const }
      const rawRes = formData.get('resolution')
      const resolution = typeof rawRes === 'string' && rawRes ? rawRes : '@1x'
      const rawOutputAs = formData.get('output_as')
      const output_as: AssetOutputFormat = (() => {
        if (typeof rawOutputAs !== 'string' || !rawOutputAs) return { type: 'original' }
        return assetOutputFormatSchema.parse(JSON.parse(rawOutputAs))
      })()
      const meta = await sharp(data)
        .metadata()
        .catch(() => null)
      const width = meta?.autoOrient?.width ?? meta?.width
      const height = meta?.autoOrient?.height ?? meta?.height
      return assetContentSchema.parse({ type: 'image', resolution, output_as, width, height })
    })()

    const { db } = await getServices()
    await new AssetStore(db).add(id, { filename: file.name, mime: file.type, data, content })

    const assetsDir = process.env.ASSETS_DIRECTORY
    if (assetsDir) {
      await mkdir(assetsDir, { recursive: true })
      await writeFile(join(assetsDir, id), data)
    }

    return { id }
  },
)

export const updateAssetContent = createServerAction(
  async (id: string, patch: AssetContentUpdate): Promise<void> => {
    const toValidate: Record<string, unknown> = { type: 'image' }
    for (const [key, value] of Object.entries(patch)) {
      if (value !== null && value !== undefined) toValidate[key] = value
    }
    assetContentSchema.parse(toValidate)
    await requireAuth()
    const { db } = await getServices()
    const store = new AssetStore(db)
    // Variant files on disk are named by hashes of the pre-update content's
    // params — capture it before the update so the purge can address them.
    const oldContent = (await store.getMeta(id))?.content ?? null
    await store.updateContent(id, patch)
    await purgeGeneratedAssetFiles(id, oldContent)
  },
)

const purgeGeneratedAssetFiles = async (
  id: string,
  content: AssetContent | null,
): Promise<void> => {
  const assetsDir = process.env.ASSETS_DIRECTORY
  if (!assetsDir) return
  const names = assetVariantFilenames(id, content?.type === 'image' ? content : null)
  await Promise.all(names.map((name) => unlink(join(assetsDir, name)).catch(() => {})))
}
