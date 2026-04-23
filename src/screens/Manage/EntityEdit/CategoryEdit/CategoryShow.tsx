import { getServices } from '@cms/services/getServices'
import { CategoryStore } from '@cms/services/CategoryStore'
import { PostStore } from '@cms/services/PostStore'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { WithBreadcrumbs } from '@cms/screens/Manage/BreadCrumbs/Breadcrumbs'
import { routing } from '@cms/screens/Manage/routing'
import { PostReorderList } from '@cms/components/PostReorderList/PostReorderList'

export default async function CategoryShow({ id }: { id?: string }) {
  if (!id) notFound()

  const services = await getServices()
  const category = await new CategoryStore(services.db).query().byId(id).first()
  if (!category) notFound()

  const posts = await new PostStore(services.db).query().inCategory({ id }).all()

  return (
    <WithBreadcrumbs
      items={[
        { name: 'Dashboard', url: '/manage' },
        { name: 'Categories', url: routing.entityList('category') },
        { name: category.name },
      ]}
    >
      <div className="p-4">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl font-bold">{category.name}</h1>
          <Link
            href={routing.entityEdit('category', id)}
            className="button flex items-center gap-1"
          >
            <span>Edit</span>
          </Link>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-xl font-bold">Posts</h2>
          <Link
            href={`${routing.entityAdd('post')}?category=${id}`}
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
