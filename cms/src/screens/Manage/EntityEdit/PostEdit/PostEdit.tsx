import type { Context } from '#cms/framework/context.ts'
import { notFound } from '#cms/framework/not_found.ts'
import { Client } from './Client.tsx'
import { WithBreadcrumbs } from '#cms/screens/Manage/BreadCrumbs/Breadcrumbs.tsx'
import { routing } from '#cms/screens/Manage/routing.ts'
import { PostStore } from '#cms/services/PostStore.ts'
import { BlockStore } from '#cms/services/BlockStore.ts'
import { CategoryStore } from '#cms/services/CategoryStore.ts'
import { LocalizationStore } from '#cms/services/LocalizationStore.ts'
import { AssetStore } from '#cms/services/AssetStore.ts'
import { TagStore } from '#cms/services/TagStore.ts'
import { AttributeStore } from '#cms/services/AttributeStore.ts'
import type { BlockData } from '#cms/lib/blocks/declarations.ts'
import { getDb, getUrl } from '#cms/framework/context.ts'

// A post to edit, by `id`, or a new one: blank, or with ?from=<id>, a copy of that
// post, which the editor gives ids of its own (copyContent.ts).
export default async function PostEdit({ ctx, id: postId }: { ctx: Context; id?: string }) {
  const db = getDb(ctx)
  const from = postId ? undefined : (getUrl(ctx).searchParams.get('from') ?? undefined)
  const id = postId ?? from

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
  const post = postId ? (postRow ?? undefined) : undefined
  const copyOf = from ? (postRow ?? undefined) : undefined

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
  const [category, assetContents, assetSizes, assetMimes] = await Promise.all([
    postRow ? new CategoryStore(db).query().byId(postRow.categoryId).first() : undefined,
    assetIds.length ? assetStore.getContent(assetIds) : {},
    assetIds.length ? assetStore.getSizes(assetIds) : {},
    assetIds.length ? assetStore.getMimes(assetIds) : {},
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
        copyOf={copyOf}
        blocks={blocks}
        categories={categories}
        tags={tags}
        initialTagIds={initialTagIds}
        initialAttributes={initialAttributes}
        translations={translations}
        assetContents={assetContents}
        assetSizes={assetSizes}
        assetMimes={assetMimes}
      />
    </WithBreadcrumbs>
  )
}
