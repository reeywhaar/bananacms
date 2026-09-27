import { CategoryStore } from '#cms/services/CategoryStore.ts'
import type { Context } from '#cms/framework/context.ts'
import { LocalizationStore } from '#cms/services/LocalizationStore.ts'
import { BlockStore } from '#cms/services/BlockStore.ts'
import { AssetStore } from '#cms/services/AssetStore.ts'
import { AttributeStore } from '#cms/services/AttributeStore.ts'
import type { BlockData } from '#cms/lib/blocks/declarations.ts'
import { notFound } from '#cms/framework/not_found.ts'
import { Client } from './Client.tsx'
import { WithBreadcrumbs } from '#cms/screens/Manage/BreadCrumbs/Breadcrumbs.tsx'
import { routing } from '#cms/screens/Manage/routing.ts'
import { getDb } from '#cms/framework/context.ts'

export default async function CategoryEdit({ ctx, id }: { ctx: Context; id?: string }) {
  const db = getDb(ctx)

  const [categoryRow, blocks, translations, initialAttributes] = await Promise.all([
    id ? new CategoryStore(db).query().byId(id).first() : undefined,
    id ? new BlockStore(db).query().parentedBy({ table: 'category', id }).all() : [],
    id ? new LocalizationStore(db).getByParentId('category', id) : {},
    id ? new AttributeStore(db).query().parentedBy({ table: 'category', id }).all() : [],
  ])
  if (id && !categoryRow) notFound()
  const category = categoryRow ?? undefined

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
  const [assetContents, assetSizes] = assetIds.length
    ? await Promise.all([assetStore.getContent(assetIds), assetStore.getSizes(assetIds)])
    : [{}, {}]

  return (
    <WithBreadcrumbs
      items={[
        { name: 'Dashboard', url: routing.manage },
        { name: 'Categories', url: routing.entityList('category') },
        { name: category?.name ?? 'New Category' },
      ]}
    >
      <Client
        category={category}
        blocks={blocks}
        initialAttributes={initialAttributes}
        translations={translations}
        assetContents={assetContents}
        assetSizes={assetSizes}
      />
    </WithBreadcrumbs>
  )
}
