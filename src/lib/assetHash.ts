import { sha256 } from 'crypto-lite'
import type { AssetOutputFormat, AssetResolution } from '@cms/services/AssetStore'

export const serializeOutputFormat = (f: AssetOutputFormat): string => {
  switch (f.type) {
    case 'jpeg':
    case 'webp':
      return `${f.type}/${f.quality}`
    default:
      return f.type
  }
}

const serializeMaxSize = (maxSize?: { width: number; height: number }): string =>
  maxSize ? `${maxSize.width}x${maxSize.height}` : '-'

export const assetVariantHash = (
  assetId: string,
  outputAs: AssetOutputFormat,
  res: AssetResolution,
  maxRes: AssetResolution,
  maxSize?: { width: number; height: number },
): string =>
  sha256(
    `${assetId}:${serializeOutputFormat(outputAs)}:${res}:${maxRes}:${serializeMaxSize(maxSize)}`,
  ).slice(0, 12)
