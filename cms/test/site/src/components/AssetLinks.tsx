'use client'

import { getAssetUrl, getOptimizedAssetSrcSet } from '@reeywhaar/bananacms/client'

// a client component that builds asset URLs, as a site's image galleries do
export function AssetLinks(props: { assetId: string }) {
  const { srcSet } = getOptimizedAssetSrcSet(props.assetId, { type: 'webp', quality: 80 }, '@2x')
  return (
    <p>
      <a href={getAssetUrl(props.assetId)}>The file</a>
      <img alt="" srcSet={srcSet} />
    </p>
  )
}
