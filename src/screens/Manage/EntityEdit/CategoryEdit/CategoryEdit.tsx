import { CategoryStore } from '@cms/services/CategoryStore'
import { getServices } from '@cms/services/getServices'
import { LocalizationStore } from '@cms/services/LocalizationStore'
import { BlockStore } from '@cms/services/BlockStore'
import { AssetStore } from '@cms/services/AssetStore'
import { AttributeStore } from '@cms/services/AttributeStore'
import { BlockData } from '@cms/lib/blocks/declarations'
import { notFound } from 'next/navigation'
import { Client } from './Client'
import { WithBreadcrumbs } from '../../BreadCrumbs/Breadcrumbs'
import { routing } from '../../routing'

export default async function CategoryEdit({ id }: { id?: string }) {
  const db = (await getServices()).db

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
