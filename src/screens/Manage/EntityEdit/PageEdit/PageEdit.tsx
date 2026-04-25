import { getServices } from '@cms/services/getServices'
import { notFound } from 'next/navigation'
import { Client } from './Client'
import { WithBreadcrumbs } from '../../BreadCrumbs/Breadcrumbs'
import { routing } from '../../routing'
import { PageStore } from '@cms/services/PageStore'
import { BlockStore } from '@cms/services/BlockStore'
import { LocalizationStore } from '@cms/services/LocalizationStore'
import { AssetStore } from '@cms/services/AssetStore'
import { AttributeStore } from '@cms/services/AttributeStore'
import { BlockData } from '@cms/lib/blocks/declarations'

export default async function PageEdit({ id }: { id?: string }) {
  const db = (await getServices()).db

  const page = await (async () => {
    if (!id) return undefined
    return (await new PageStore(db).get(id)) ?? notFound()
  })()

  const blocks = await (async () => {
    if (!id) return []
    return new BlockStore(db).getByParent('page', id)
  })()

  const translations = id ? await new LocalizationStore(db).getByParentId('page', id) : {}

  const initialAttributes = id ? await new AttributeStore(db).getByParent('page', id) : []

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
    ? await Promise.all([
        assetStore.getContent(imageAssetIds),
        assetStore.getSizes(imageAssetIds),
      ])
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
