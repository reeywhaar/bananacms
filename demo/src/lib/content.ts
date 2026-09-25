import {
  getAssetUrl,
  getDb,
  getImagesMetadata,
  getOptimizedAssetSrcSet,
  type BlockData,
  type BlockTypeImage,
  type Context,
} from '@reeywhaar/bananacms'
import { AssetStore, BlockStore, PageStore } from '@reeywhaar/bananacms/stores'

// Reading the CMS's content for the site's pages. A page finds its blocks by
// their keys (seed/README.md).

export type ImageBlock = BlockData & { content: BlockTypeImage }

// what an <img> needs for an image, and the file's URL for any other asset
export type ImageSource = { src: string; srcSet: string; width?: number; height?: number }
export type Assets = { images: Map<string, ImageSource>; files: Map<string, AssetFile> }
export type AssetFile = { url: string; size?: number; mime?: string }

export const byKey = (blocks: BlockData[], key: string): BlockData | undefined =>
  blocks.find((block) => block.content.key === key)

// the text of the block `key`, when it's a text block
export const textOf = (blocks: BlockData[], key: string): string | undefined => {
  const block = byKey(blocks, key)
  return block?.content.type === 'text' ? block.content.text : undefined
}

// the blocks a group holds, or none
export const childrenOf = (block: BlockData | undefined): BlockData[] =>
  block?.content.type === 'group' ? block.content.blocks : []

export const attributeOf = (block: BlockData, key: string): string | undefined =>
  block.attributes.find((attribute) => attribute.key === key)?.text

// the entity's picture: its first image, a post's cover or still
export const pictureOf = (blocks: BlockData[]): ImageBlock | undefined =>
  blocks.find((block): block is ImageBlock => block.content.type === 'image')

export function imagesIn(blocks: BlockData[]): ImageBlock[] {
  return blocks.flatMap((block) =>
    block.content.type === 'image'
      ? [block as ImageBlock]
      : block.content.type === 'group'
        ? imagesIn(block.content.blocks)
        : [],
  )
}

function filesIn(blocks: BlockData[]): string[] {
  return blocks.flatMap((block) =>
    block.content.type === 'asset'
      ? [block.content.assetId]
      : block.content.type === 'group'
        ? filesIn(block.content.blocks)
        : [],
  )
}

// The images and files the blocks show, fetched together: each image's URL for
// each pixel density, from the CMS's variants, and its size in CSS pixels
export async function assetsOf(ctx: Context, blocks: BlockData[]): Promise<Assets> {
  const imageIds = [...new Set(imagesIn(blocks).map((block) => block.content.assetId))]
  const fileIds = [...new Set(filesIn(blocks))]
  const store = new AssetStore(getDb(ctx))
  const [contents, layouts, sizes, metas] = await Promise.all([
    store.getContent(imageIds),
    getImagesMetadata(ctx, imageIds),
    store.getSizes(fileIds),
    Promise.all(fileIds.map((id) => store.getMeta(id))),
  ])
  const images = new Map(
    imageIds.map((id): [string, ImageSource] => {
      const content = contents[id]
      const image = content?.type === 'image' ? content : undefined
      const { src, srcSet } = getOptimizedAssetSrcSet(
        id,
        image?.output_as ?? { type: 'original' },
        image?.resolution ?? '@1x',
        image?.maxSize,
      )
      return [id, { src, srcSet, ...layouts[id] }]
    }),
  )
  const files = new Map(
    fileIds.map((id, i): [string, AssetFile] => [
      id,
      { url: getAssetUrl(id), size: sizes[id], mime: metas[i]?.mime },
    ]),
  )
  return { images, files }
}

// the blocks of each entity of `table`, in `locale`
export const blocksOf = (
  ctx: Context,
  locale: string,
  table: 'post' | 'category' | 'tag' | 'page',
  ids: string[],
) => new BlockStore(getDb(ctx)).getPublicByParentIds(locale, table, ids)

// The page `key`'s blocks in `locale`, with the page's id, or undefined when the
// CMS has no such page, as on a site that isn't seeded
export async function pageBlocks(
  ctx: Context,
  key: string,
  locale: string,
): Promise<{ id: string; blocks: BlockData[] } | undefined> {
  const page = await new PageStore(getDb(ctx)).query().byKey(key).first()
  if (!page) return undefined
  const blocks = await blocksOf(ctx, locale, 'page', [page.id])
  return { id: page.id, blocks: blocks[page.id] ?? [] }
}
