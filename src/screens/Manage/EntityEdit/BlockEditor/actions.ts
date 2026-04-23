'use server'

import { mkdir, readdir, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'
import { getServices } from '@cms/services/getServices'
import {
  AssetStore,
  AssetContent,
  AssetContentUpdate,
  AssetOutputFormat,
  assetContentSchema,
  assetOutputFormatSchema,
} from '@cms/services/AssetStore'
import { v7 } from 'uuid'

export const uploadAsset = async (formData: FormData): Promise<{ id: string }> => {
  const file = formData.get('file')
  if (!(file instanceof File)) throw new Error('No file provided')

  const id = v7()
  const arrayBuffer = await file.arrayBuffer()
  const data = Buffer.from(arrayBuffer)

  const content: AssetContent | null = await (async () => {
    if (!file.type.startsWith('image/')) return null
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
    return assetContentSchema.parse({ resolution, output_as, width, height })
  })()

  const { db } = await getServices()
  await new AssetStore(db).add(id, { filename: file.name, mime: file.type, data, content })

  const assetsDir = process.env.ASSETS_DIRECTORY
  if (assetsDir) {
    await mkdir(assetsDir, { recursive: true })
    await writeFile(join(assetsDir, id), data)
  }

  return { id }
}

export const updateAssetContent = async (
  id: string,
  patch: AssetContentUpdate,
): Promise<void> => {
  const toValidate: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (value !== null && value !== undefined) toValidate[key] = value
  }
  assetContentSchema.parse(toValidate)
  const { db } = await getServices()
  await new AssetStore(db).updateContent(id, patch)
  await purgeGeneratedAssetFiles(id)
}

const purgeGeneratedAssetFiles = async (id: string): Promise<void> => {
  const assetsDir = process.env.ASSETS_DIRECTORY
  if (!assetsDir) return
  const entries = await readdir(assetsDir).catch(() => [] as string[])
  const prefix = `${id}-`
  await Promise.all(
    entries
      .filter((name) => name.startsWith(prefix))
      .map((name) => unlink(join(assetsDir, name)).catch(() => {})),
  )
}
