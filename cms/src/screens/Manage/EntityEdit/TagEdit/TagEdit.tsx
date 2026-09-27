import { TagStore } from '#cms/services/TagStore.ts'
import { AttributeStore } from '#cms/services/AttributeStore.ts'
import { BlockStore } from '#cms/services/BlockStore.ts'
import { AssetStore } from '#cms/services/AssetStore.ts'
import type { Context } from '#cms/framework/context.ts'
import { LocalizationStore } from '#cms/services/LocalizationStore.ts'
import type { BlockData } from '#cms/lib/blocks/declarations.ts'
import { notFound } from '#cms/framework/not_found.ts'
import { Client } from './Client.tsx'
import { WithBreadcrumbs } from '#cms/screens/Manage/BreadCrumbs/Breadcrumbs.tsx'
import { routing } from '#cms/screens/Manage/routing.ts'
import { getDb } from '#cms/framework/context.ts'

export default async function TagEdit({ ctx, id }: { ctx: Context; id?: string }) {
  const db = getDb(ctx)

  const [tagRow, blocks, translations, initialAttributes] = await Promise.all([
    id ? new TagStore(db).query().byId(id).first() : undefined,
    id ? new BlockStore(db).query().parentedBy({ table: 'tag', id }).all() : [],
    id ? new LocalizationStore(db).getByParentId('tag', id) : {},
    id ? new AttributeStore(db).query().parentedBy({ table: 'tag', id }).all() : [],
  ])
  if (id && !tagRow) notFound()
  const tag = tagRow ?? undefined

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
  const [assetContents, assetSizes, assetMimes] = assetIds.length
    ? await Promise.all([
        assetStore.getContent(assetIds),
        assetStore.getSizes(assetIds),
        assetStore.getMimes(assetIds),
      ])
    : [{}, {}, {}]

  return (
    <WithBreadcrumbs
      items={[
        { name: 'Dashboard', url: routing.manage },
        { name: 'Tags', url: routing.entityList('tag') },
        { name: tag?.name ?? 'New Tag' },
      ]}
    >
      <Client
        tag={tag}
        blocks={blocks}
        translations={translations}
        initialAttributes={initialAttributes}
        assetContents={assetContents}
        assetSizes={assetSizes}
        assetMimes={assetMimes}
      />
    </WithBreadcrumbs>
  )
}
