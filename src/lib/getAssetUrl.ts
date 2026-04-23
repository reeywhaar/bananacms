import type { AssetOutputFormat, AssetResolution } from '@cms/services/AssetStore'
import { assetVariantHash } from './assetHash'

const origin = (process.env.NEXT_PUBLIC_SERVER_URL ?? '').replace(/\/+$/, '')

export const getAssetUrl = (assetId: string) => {
  return `${origin}/d/${assetId}`
}

export const getOptimizedAssetUrl = (
  assetId: string,
  outputAs: AssetOutputFormat,
  res: AssetResolution,
  maxRes: AssetResolution,
  maxSize?: { width: number; height: number },
): string => {
  const hash = assetVariantHash(assetId, outputAs, res, maxRes, maxSize)
  return `${origin}/d/${assetId}/${hash}?res=${encodeURIComponent(res)}`
}

const RESOLUTIONS: AssetResolution[] = ['@1x', '@2x', '@3x']

export const getOptimizedAssetSrcSet = (
  assetId: string,
  outputAs: AssetOutputFormat,
  maxRes: AssetResolution,
  maxSize?: { width: number; height: number },
): { src: string; srcSet: string } => ({
  src: getOptimizedAssetUrl(assetId, outputAs, '@1x', maxRes, maxSize),
  srcSet: RESOLUTIONS.map(
    (r, i) => `${getOptimizedAssetUrl(assetId, outputAs, r, maxRes, maxSize)} ${i + 1}x`,
  ).join(', '),
})
