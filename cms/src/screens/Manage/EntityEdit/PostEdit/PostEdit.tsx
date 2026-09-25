import type { Context } from '../../../../framework/context.ts'
import { notFound } from '../../../../framework/not-found.ts'
import { Client } from './Client.tsx'
import { WithBreadcrumbs } from '../../BreadCrumbs/Breadcrumbs.tsx'
import { routing } from '../../routing.ts'
import { PostStore } from '../../../../services/PostStore.ts'
import { BlockStore } from '../../../../services/BlockStore.ts'
import { CategoryStore } from '../../../../services/CategoryStore.ts'
import { LocalizationStore } from '../../../../services/LocalizationStore.ts'
import { AssetStore } from '../../../../services/AssetStore.ts'
import { TagStore } from '../../../../services/TagStore.ts'
import { AttributeStore } from '../../../../services/AttributeStore.ts'
import type { BlockData } from '../../../../lib/blocks/declarations.ts'
import { getDb } from '../../../../framework/context.ts'

export default async function PostEdit({ ctx, id }: { ctx: Context; id?: string }) {
  const db = getDb(ctx)

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
