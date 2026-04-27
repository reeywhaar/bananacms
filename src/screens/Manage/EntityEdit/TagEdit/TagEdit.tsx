import { TagStore } from '@cms/services/TagStore'
import { getServices } from '@cms/services/getServices'
import { LocalizationStore } from '@cms/services/LocalizationStore'
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

  const translations = id ? new LocalizationStore(db).getByKeyPrefix('tag:' + id + ':') : {}

  return (
    <WithBreadcrumbs
      items={[
        { name: 'Dashboard', url: routing.manage },
        { name: 'Tags', url: routing.entityList('tag') },
        { name: tag?.name ?? 'New Tag' },
      ]}
    >
      <Client tag={tag} translations={translations} />
    </WithBreadcrumbs>
  )
}
