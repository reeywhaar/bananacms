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

  // Everything keyed only by `id` runs as one batch; the category lookup and
  // asset metadata depend on its results and form a second one.
  const tagStore = new TagStore(db)
  const [postRow, blocks, categories, tags, initialTagIds, initialAttributes, translations] =
    await Promise.all([
      id ? new PostStore(db).query().byId(id).first() : undefined,
      id ? new BlockStore(db).query().parentedBy({ table: 'post', id }).all() : [],
      new CategoryStore(db).query().all(),
      tagStore.query().withPostCount().all(),
      id
        ? tagStore
            .query()
            .taggedTo({ table: 'post', id })
            .all()
            .then((tagged) => tagged.map((t) => t.id))
        : [],
      id ? new AttributeStore(db).query().parentedBy({ table: 'post', id }).all() : [],
      id ? new LocalizationStore(db).getByParentId('post', id) : {},
    ])
  if (id && !postRow) notFound()
  const post = postRow ?? undefined

  const assetIds: string[] = []
  const collect = (list: BlockData[]): void => {
    for (const b of list) {
      if (b.content.type === 'image' && b.content.assetId) assetIds.push(b.content.assetId)
      if (b.content.type === 'asset' && b.content.assetId) assetIds.push(b.content.assetId)
      if (b.content.type === 'group') collect(b.content.blocks)
    }
  }
  collect(blocks)

  const assetStore = new AssetStore(db)
  const [category, assetContents, assetSizes] = await Promise.all([
    post ? new CategoryStore(db).query().byId(post.categoryId).first() : undefined,
    assetIds.length ? assetStore.getContent(assetIds) : {},
    assetIds.length ? assetStore.getSizes(assetIds) : {},
  ])

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
