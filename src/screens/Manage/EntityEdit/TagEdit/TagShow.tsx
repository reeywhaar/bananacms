import { getServices } from '@cms/services/getServices'
import { TagStore } from '@cms/services/TagStore'
import { PostStore } from '@cms/services/PostStore'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { WithBreadcrumbs } from '@cms/screens/Manage/BreadCrumbs/Breadcrumbs'
import { routing } from '@cms/screens/Manage/routing'
import { PostReorderList } from '@cms/components/PostReorderList/PostReorderList'

export default async function TagShow({ id }: { id?: string }) {
  if (!id) notFound()

  const services = await getServices()
  const tag = await new TagStore(services.db).query().byId(id).first()
  if (!tag) notFound()

  const posts = await new PostStore(services.db).query().withTag({ id }).all()

  return (
    <WithBreadcrumbs
      items={[
        { name: 'Dashboard', url: '/manage' },
        { name: 'Tags', url: routing.entityList('tag') },
        { name: tag.name },
      ]}
    >
      <div className="p-4">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl font-bold">{tag.name}</h1>
          <Link href={routing.entityEdit('tag', id)} className="button flex items-center gap-1">
            <span>Edit</span>
          </Link>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-xl font-bold">Posts</h2>
          <Link
            href={`${routing.entityAdd('post')}?tags=${id}`}
            className="button flex items-center gap-1"
          >
            <span>New</span>
          </Link>
        </div>
        <PostReorderList posts={posts} />
      </div>
    </WithBreadcrumbs>
  )
}
