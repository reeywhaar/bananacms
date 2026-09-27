import type { Context } from '#cms/framework/context.ts'
import { notFound } from '#cms/framework/not_found.ts'
import { Client } from './Client.tsx'
import { WithBreadcrumbs } from '#cms/screens/Manage/BreadCrumbs/Breadcrumbs.tsx'
import { routing } from '#cms/screens/Manage/routing.ts'
import { PageStore } from '#cms/services/PageStore.ts'
import { BlockStore } from '#cms/services/BlockStore.ts'
import { LocalizationStore } from '#cms/services/LocalizationStore.ts'
import { AssetStore } from '#cms/services/AssetStore.ts'
import { AttributeStore } from '#cms/services/AttributeStore.ts'
import type { BlockData } from '#cms/lib/blocks/declarations.ts'
import { getDb } from '#cms/framework/context.ts'

export default async function PageEdit({ ctx, id }: { ctx: Context; id?: string }) {
  const db = getDb(ctx)

  const [pageRow, blocks, translations, initialAttributes] = await Promise.all([
    id ? new PageStore(db).query().byId(id).first() : undefined,
    id ? new BlockStore(db).query().parentedBy({ table: 'page', id }).all() : [],
    id ? new LocalizationStore(db).getByParentId('page', id) : {},
    id ? new AttributeStore(db).query().parentedBy({ table: 'page', id }).all() : [],
  ])
  if (id && !pageRow) notFound()
  const page = pageRow ?? undefined

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
        { name: 'Pages', url: routing.entityList('page') },
        { name: page?.key ?? 'New Page' },
      ]}
    >
      <Client
        page={page}
        blocks={blocks}
        initialAttributes={initialAttributes}
        translations={translations}
        assetContents={assetContents}
        assetSizes={assetSizes}
        assetMimes={assetMimes}
      />
    </WithBreadcrumbs>
  )
}
