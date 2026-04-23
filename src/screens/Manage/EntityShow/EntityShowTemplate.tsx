import Link from 'next/link'
import { WithBreadcrumbs } from '../BreadCrumbs/Breadcrumbs'
import { routing } from '../routing'

type Props = {
  entityKey: string
  entityDisplayName: string
  parentId: string
  parentName: string
  childrenCreateLink?: string
  childrenDisplayName: string
  childrenEntities: { name: string; url: string; status?: string }[]
}

export default function EntityShowTemplate({
  entityKey,
  entityDisplayName,
  parentId,
  parentName,
  childrenCreateLink,
  childrenDisplayName,
  childrenEntities,
}: Props) {
  return (
    <WithBreadcrumbs
      items={[
        { name: 'Dashboard', url: '/manage' },
        { name: entityDisplayName, url: routing.entityList(entityKey) },
        { name: parentName },
      ]}
    >
      <div className="p-4">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl font-bold">{parentName}</h1>
          {childrenCreateLink && (
            <Link
              href={routing.entityEdit(entityKey, parentId)}
              className="button flex items-center gap-1"
            >
              <span>Edit</span>
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-xl font-bold">{childrenDisplayName}</h2>
          {childrenCreateLink && (
            <Link href={childrenCreateLink} className="button flex items-center gap-1">
              <span>New</span>
            </Link>
          )}
        </div>
        {childrenEntities.length ? (
          childrenEntities.map((item) => (
            <div key={item.url} className="flex items-center gap-2">
              <Link className="link" href={item.url}>
                {item.name}
              </Link>
              {item.status && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${item.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {item.status}
                </span>
              )}
            </div>
          ))
        ) : (
          <div className="text-sm italic opacity-50">
            No {childrenDisplayName.toLowerCase()} yet.
          </div>
        )}
      </div>
    </WithBreadcrumbs>
  )
}
