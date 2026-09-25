import type { Context } from '../../../../framework/context.ts'
import { TagStore } from '../../../../services/TagStore.ts'
import { PostStore } from '../../../../services/PostStore.ts'
import { notFound } from '../../../../framework/not-found.ts'
import { Link } from '../../../../framework/link.tsx'
import { WithBreadcrumbs } from '../../BreadCrumbs/Breadcrumbs.tsx'
import { routing } from '../../routing.ts'
import { PostReorderList } from '../../../../components/PostReorderList/PostReorderList.tsx'
import { getDb } from '../../../../framework/context.ts'

export default async function TagShow({ ctx, id }: { ctx: Context; id?: string }) {
  if (!id) notFound()
  const tag = await new TagStore(getDb(ctx)).query().byId(id).first()
  if (!tag) notFound()

  const posts = await new PostStore(getDb(ctx)).query().withTag({ id }).all()

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
        <PostReorderList ctx={ctx} posts={posts} />
      </div>
    </WithBreadcrumbs>
  )
}
