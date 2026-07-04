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
  const [assetContents, assetSizes] = assetIds.length
    ? await Promise.all([assetStore.getContent(assetIds), assetStore.getSizes(assetIds)])
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
