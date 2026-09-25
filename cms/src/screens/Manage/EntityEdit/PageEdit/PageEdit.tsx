import type { Context } from '../../../../framework/context.ts'
import { notFound } from '../../../../framework/not-found.ts'
import { Client } from './Client.tsx'
import { WithBreadcrumbs } from '../../BreadCrumbs/Breadcrumbs.tsx'
import { routing } from '../../routing.ts'
import { PageStore } from '../../../../services/PageStore.ts'
import { BlockStore } from '../../../../services/BlockStore.ts'
import { LocalizationStore } from '../../../../services/LocalizationStore.ts'
import { AssetStore } from '../../../../services/AssetStore.ts'
import { AttributeStore } from '../../../../services/AttributeStore.ts'
import type { BlockData } from '../../../../lib/blocks/declarations.ts'
import { getDb } from '../../../../framework/context.ts'

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
  const [assetContents, assetSizes] = assetIds.length
    ? await Promise.all([assetStore.getContent(assetIds), assetStore.getSizes(assetIds)])
    : [{}, {}]

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
      />
    </WithBreadcrumbs>
  )
}
