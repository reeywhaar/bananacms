import { getEntityDescriptor } from '@cms/lib/entities'
import { getServices } from '@cms/services/getServices'
import { TagStore } from '@cms/services/TagStore'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { WithBreadcrumbs } from '../BreadCrumbs/Breadcrumbs'
import { routing } from '../routing'

export default async function EntityList({ params }: { params: Promise<{ entity: string }> }) {
  const services = await getServices()
  const entity = (await params).entity
  const entityDescriptor = getEntityDescriptor(entity)
  if (!entityDescriptor) notFound()
  const store = new entityDescriptor.store(services.db)
  let items
  if (entity === 'tag') {
    items = await new TagStore(services.db).query().withPostCount().all()
  } else {
    items = await store.query().all()
  }

  return (
    <WithBreadcrumbs
      items={[{ name: 'Dashboard', url: '/manage' }, { name: entityDescriptor.displayName }]}
    >
      <div className="p-4">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl font-bold">{entityDescriptor.displayName}</h1>
          <Link href={`/manage/e/${entity}/add`} className="button flex items-center gap-1">
            <span className="text-xl leading-none">+</span>
            <span>New</span>
          </Link>
        </div>
        {entityDescriptor.renderList
          ? entityDescriptor.renderList(items)
          : items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <Link
                  className="link"
                  href={
                    entityDescriptor.show
                      ? routing.entityShow(entity, item.id)
                      : routing.entityEdit(entity, item.id)
                  }
                >
                  {item.name}
                </Link>
                {'postCount' in item && (
                  <span className="text-sm text-gray-400">
                    {item.postCount as number} {(item.postCount as number) === 1 ? 'post' : 'posts'}
                  </span>
                )}
              </div>
            ))}
      </div>
    </WithBreadcrumbs>
  )
}
