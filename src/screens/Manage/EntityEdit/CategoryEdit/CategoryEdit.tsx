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

  const category = await (async () => {
    if (!id) return undefined
    return (await new CategoryStore(db).query().byId(id).first()) ?? notFound()
  })()

  const blocks = await (async () => {
    if (!id) return []
    return new BlockStore(db).query().parentedBy({ table: 'category', id }).all()
  })()

  const translations = id ? await new LocalizationStore(db).getByParentId('category', id) : {}

  const initialAttributes = id
    ? await new AttributeStore(db).query().parentedBy({ table: 'category', id }).all()
    : []

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
