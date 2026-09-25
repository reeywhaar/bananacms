import type { Context } from '../../../../framework/context.ts'
import { CategoryStore } from '../../../../services/CategoryStore.ts'
import { PostStore } from '../../../../services/PostStore.ts'
import { notFound } from '../../../../framework/not-found.ts'
import { Link } from '../../../../framework/link.tsx'
import { WithBreadcrumbs } from '../../BreadCrumbs/Breadcrumbs.tsx'
import { routing } from '../../routing.ts'
import { PostReorderList } from '../../../../components/PostReorderList/PostReorderList.tsx'
import { getDb } from '../../../../framework/context.ts'

export default async function CategoryShow({ ctx, id }: { ctx: Context; id?: string }) {
  if (!id) notFound()
  const category = await new CategoryStore(getDb(ctx)).query().byId(id).first()
  if (!category) notFound()

  const posts = await new PostStore(getDb(ctx)).query().inCategory({ id }).all()

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
        <PostReorderList ctx={ctx} posts={posts} />
      </div>
    </WithBreadcrumbs>
  )
}
