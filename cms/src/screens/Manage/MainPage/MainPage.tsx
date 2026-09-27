import type { Context } from '#cms/framework/context.ts'
import { getDb } from '#cms/framework/context.ts'
import { Link } from '#cms/framework/link.tsx'
import { CategoryStore } from '#cms/services/CategoryStore.ts'
import { PageStore } from '#cms/services/PageStore.ts'
import { PostStore } from '#cms/services/PostStore.ts'
import { TagStore } from '#cms/services/TagStore.ts'
import { routing } from '../routing.ts'

// The entities, each a card with how many there are, drafts among the posts
// included, which opens its list.
export default async function ManagePage({ ctx }: { ctx: Context }) {
  const db = getDb(ctx)
  const [pages, posts, categories, tags] = await Promise.all([
    new PageStore(db).query().count(),
    new PostStore(db).query().count(),
    new CategoryStore(db).query().count(),
    new TagStore(db).query().count(),
  ])
  const cards = [
    { name: 'Pages', count: pages, href: routing.entityList('page') },
    { name: 'Posts', count: posts, href: routing.entityList('post') },
    { name: 'Categories', count: categories, href: routing.entityList('category') },
    { name: 'Tags', count: tags, href: routing.entityList('tag') },
  ]

  return (
    <main className="p-4">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.name}
            href={card.href}
            className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300"
          >
            <span className="text-3xl font-semibold text-gray-900">{card.count}</span>
            <span className="text-sm text-link">{card.name}</span>
          </Link>
        ))}
      </div>
    </main>
  )
}
