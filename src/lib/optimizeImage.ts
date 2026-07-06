import sharp from 'sharp'
import type { AssetOutputFormat, AssetResolution } from '@cms/services/AssetStore'
import { imageEncodeSemaphore } from '@cms/utils/semaphore'

const resFactor: Record<AssetResolution, number> = { '@1x': 1, '@2x': 2, '@3x': 3 }

export type OptimizeImageOptions = {
  sourceRes: AssetResolution
  targetRes: AssetResolution
  format: AssetOutputFormat
  sourceMime: string
  maxSize?: { width: number; height: number }
}

export const optimizeImage = (
  source: Buffer,
  opts: OptimizeImageOptions,
): Promise<{ data: Buffer; mime: string }> => imageEncodeSemaphore().run(() => encode(source, opts))

const encode = async (
  source: Buffer,
  opts: OptimizeImageOptions,
): Promise<{ data: Buffer; mime: string }> => {
  let pipeline = sharp(source).autoOrient()

  const ratio = resFactor[opts.targetRes] / resFactor[opts.sourceRes]
  if (ratio < 1 || opts.maxSize) {
    const meta = await sharp(source).metadata()
    const orientedW = meta.autoOrient?.width ?? meta.width
    const orientedH = meta.autoOrient?.height ?? meta.height
    if (orientedW && orientedH) {
      let tW = orientedW
      let tH = orientedH
      if (opts.maxSize) {
        const k = Math.min(opts.maxSize.width / tW, opts.maxSize.height / tH, 1)
        tW = tW * k
        tH = tH * k
      }
      if (ratio < 1) {
        tW = tW * ratio
        tH = tH * ratio
      }
      const width = Math.max(1, Math.round(tW))
      const height = Math.max(1, Math.round(tH))
      pipeline = pipeline.resize({
        width,
        height,
        fit: 'inside',
        withoutEnlargement: true,
      })
    }
  }

  switch (opts.format.type) {
    case 'jpeg':
      return {
        data: await pipeline
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: opts.format.quality })
          .toBuffer(),
        mime: 'image/jpeg',
      }
    case 'webp':
      return {
        data: await pipeline.webp({ quality: opts.format.quality }).toBuffer(),
        mime: 'image/webp',
      }
    case 'gif':
      return { data: await pipeline.gif().toBuffer(), mime: 'image/gif' }
    case 'png8':
      return { data: await pipeline.png({ palette: true }).toBuffer(), mime: 'image/png' }
    case 'png24':
      return { data: await pipeline.png({ palette: false }).toBuffer(), mime: 'image/png' }
    case 'original':
    default:
      return { data: await pipeline.toBuffer(), mime: opts.sourceMime }
  }
}
