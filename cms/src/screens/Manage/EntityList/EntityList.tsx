import { getEntityDescriptor } from '#cms/lib/entities.ts'
import type { Context } from '#cms/framework/context.ts'
import { TagStore } from '#cms/services/TagStore.ts'
import { Link } from '#cms/framework/link.tsx'
import { notFound } from '#cms/framework/not_found.ts'
import { WithBreadcrumbs } from '../BreadCrumbs/Breadcrumbs.tsx'
import { routing } from '../routing.ts'
import { getDb } from '#cms/framework/context.ts'

export default async function EntityList({
  ctx,
  params,
}: {
  ctx: Context
  params: Promise<{ entity: string }>
}) {
  const entity = (await params).entity
  const entityDescriptor = getEntityDescriptor(entity)
  if (!entityDescriptor) notFound()
  const store = new entityDescriptor.store(getDb(ctx))
  let items
  if (entity === 'tag') {
    items = await new TagStore(getDb(ctx)).query().withPostCount().all()
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
          ? entityDescriptor.renderList(ctx, items)
          : items.length > 0 && (
              // each a card, with how many posts it has, if it has posts
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    href={
                      entityDescriptor.show
                        ? routing.entityShow(entity, item.id)
                        : routing.entityEdit(entity, item.id)
                    }
                    className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300"
                  >
                    <span className="wrap-anywhere font-medium text-link">{item.name}</span>
                    {'postCount' in item && (
                      <span className="text-sm text-gray-500">
                        {item.postCount as number}{' '}
                        {(item.postCount as number) === 1 ? 'post' : 'posts'}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
      </div>
    </WithBreadcrumbs>
  )
}
