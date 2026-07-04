import { sha256 } from 'crypto-lite'
import type {
  AssetImageContent,
  AssetOutputFormat,
  AssetResolution,
} from '@cms/services/AssetStore'

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

const RES_FACTOR: Record<AssetResolution, number> = { '@1x': 1, '@2x': 2, '@3x': 3 }
const RESOLUTIONS: AssetResolution[] = ['@1x', '@2x', '@3x']

/**
 * Every variant filename that can exist on disk for an asset with the given
 * image content: one per requested resolution, deduped because the
 * /d/[id]/[hash] route clamps resolutions above the source's. Lets purges
 * unlink exact names instead of readdir-scanning the whole assets dir.
 */
export const assetVariantFilenames = (
  assetId: string,
  content: AssetImageContent | null,
): string[] => {
  const outputAs = content?.output_as ?? { type: 'original' }
  const sourceRes = content?.resolution ?? '@1x'
  const maxSize = content?.maxSize
  const names = new Set<string>()
  for (const res of RESOLUTIONS) {
    const effectiveRes = RES_FACTOR[res] > RES_FACTOR[sourceRes] ? sourceRes : res
    names.add(`${assetId}-${assetVariantHash(assetId, outputAs, effectiveRes, sourceRes, maxSize)}`)
  }
  return [...names]
}
