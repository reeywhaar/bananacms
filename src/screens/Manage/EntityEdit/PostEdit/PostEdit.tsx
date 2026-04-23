import { getServices } from '@cms/services/getServices'
import { notFound } from 'next/navigation'
import { Client } from './Client'
import { WithBreadcrumbs } from '../../BreadCrumbs/Breadcrumbs'
import { routing } from '../../routing'
import { PostStore } from '@cms/services/PostStore'
import { BlockStore } from '@cms/services/BlockStore'
import { CategoryStore } from '@cms/services/CategoryStore'
import { LocalizationStore } from '@cms/services/LocalizationStore'
import { AssetStore } from '@cms/services/AssetStore'
import { TagStore } from '@cms/services/TagStore'
import { AttributeStore } from '@cms/services/AttributeStore'
import { BlockData } from '@cms/lib/blocks/declarations'

export default async function PostEdit({ id }: { id?: string }) {
  const db = (await getServices()).db

  const post = await (async () => {
    if (!id) return undefined
    return (await new PostStore(db).query().byId(id).first()) ?? notFound()
  })()

  const category = post
    ? await new CategoryStore(db).query().byId(post.categoryId).first()
    : undefined

  const blocks = await (async () => {
    if (!id) return []
    return new BlockStore(db).query().parentedBy({ table: 'post', id }).all()
  })()

  const categories = await new CategoryStore(db).query().all()

  const tagStore = new TagStore(db)
  const tags = await tagStore.query().withPostCount().all()
  const initialTagIds = id
    ? (await tagStore.query().taggedTo({ table: 'post', id }).all()).map((t) => t.id)
    : []

  const initialAttributes = id
    ? await new AttributeStore(db).query().parentedBy({ table: 'post', id }).all()
    : []

  const translations = id ? await new LocalizationStore(db).getByParentId('post', id) : {}

  const imageAssetIds: string[] = []
  const collect = (list: BlockData[]): void => {
    for (const b of list) {
      if (b.content.type === 'image' && b.content.assetId) imageAssetIds.push(b.content.assetId)
      if (b.content.type === 'group') collect(b.content.blocks)
    }
  }
  collect(blocks)

  const assetStore = new AssetStore(db)
  const [assetContents, assetSizes] = imageAssetIds.length
    ? await Promise.all([assetStore.getContent(imageAssetIds), assetStore.getSizes(imageAssetIds)])
    : [{}, {}]

  return (
    <WithBreadcrumbs
      items={[
        { name: 'Dashboard', url: routing.manage },
        ...(category
          ? [
              { name: 'Categories', url: routing.entityList('category') },
              { name: category.name, url: routing.entityShow('category', category.id) },
            ]
          : [{ name: 'Categories', url: routing.entityList('category') }]),
        { name: post?.name ?? 'New Post' },
      ]}
    >
      <Client
        key={post?.updatedAt}
        post={post}
        blocks={blocks}
        categories={categories}
        tags={tags}
        initialTagIds={initialTagIds}
        initialAttributes={initialAttributes}
        translations={translations}
        assetContents={assetContents}
        assetSizes={assetSizes}
      />
    </WithBreadcrumbs>
  )
}
