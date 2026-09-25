import type { BlockData } from '@reeywhaar/bananacms'
import { Picture } from '@app/components/Picture.tsx'
import { childrenOf, pictureOf, textOf, type Assets } from '@app/lib/content.ts'
import { BlockFrame } from './BlockFrame.tsx'

// the Main page's hero group: its eyebrow, title, body and picture
export function HeroBlock(props: { hero: BlockData | undefined; assets: Assets; locale: string }) {
  const blocks = childrenOf(props.hero)
  const picture = pictureOf(blocks)
  return (
    <BlockFrame source="CMS: page “Main page”, group hero">
      <p className="text-sm font-semibold tracking-wide text-amber-600 uppercase">
        {textOf(blocks, 'eyebrow')}
      </p>
      <h1 className="mt-1 text-3xl font-bold">{textOf(blocks, 'title')}</h1>
      <p className="mt-3 text-stone-600">{textOf(blocks, 'body')}</p>
      {picture && (
        <Picture
          block={picture}
          source={props.assets.images.get(picture.content.assetId)}
          locale={props.locale}
          className="mt-5"
          imageClassName="aspect-[5/2] object-cover"
        />
      )}
    </BlockFrame>
  )
}
