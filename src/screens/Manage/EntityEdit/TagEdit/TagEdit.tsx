import { TagStore } from '@cms/services/TagStore'
import { AttributeStore } from '@cms/services/AttributeStore'
import { BlockStore } from '@cms/services/BlockStore'
import { AssetStore } from '@cms/services/AssetStore'
import { getServices } from '@cms/services/getServices'
import { LocalizationStore } from '@cms/services/LocalizationStore'
import { BlockData } from '@cms/lib/blocks/declarations'
import { notFound } from 'next/navigation'
import { Client } from './Client'
import { WithBreadcrumbs } from '../../BreadCrumbs/Breadcrumbs'
import { routing } from '../../routing'

export default async function TagEdit({ id }: { id?: string }) {
  const db = (await getServices()).db

  const tag = await (async () => {
    if (!id) return undefined
    return (await new TagStore(db).query().byId(id).first()) ?? notFound()
  })()

  const blocks = id
    ? await new BlockStore(db).query().parentedBy({ table: 'tag', id }).all()
    : []

  const translations = id ? await new LocalizationStore(db).getByParentId('tag', id) : {}

  const initialAttributes = id
    ? await new AttributeStore(db).query().parentedBy({ table: 'tag', id }).all()
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
    ? await Promise.all([
        assetStore.getContent(imageAssetIds),
        assetStore.getSizes(imageAssetIds),
      ])
    : [{}, {}]

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
      />
    </WithBreadcrumbs>
  )
}
