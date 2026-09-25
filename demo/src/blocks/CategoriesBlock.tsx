import { getAuth, getDb, type Context } from '@reeywhaar/bananacms'
import { Link } from '@reeywhaar/bananacms/client'
import { CategoryStore, PostStore } from '@reeywhaar/bananacms/stores'
import { PostCard } from '@app/components/PostCard.tsx'
import { assetsOf, blocksOf, textOf } from '@app/lib/content.ts'
import { t } from '@app/lib/i18n.ts'

// Each category with its first posts: drafts too for a signed-in user
export async function CategoriesBlock(props: { ctx: Context; locale: string }) {
  const { ctx, locale } = props
  const db = getDb(ctx)
  const signedIn = Boolean(getAuth(ctx))
  const categories = await new CategoryStore(db)
    .query()
    .locale(locale)
    .orderBy('slug', 'desc')
    .all()
  const lists = await Promise.all(
    categories.map(async (category) => ({
      category,
      posts: await new PostStore(db)
        .query()
        .inCategory({ id: category.id })
        .locale(locale)
        .map((query) => (signedIn ? query : query.published()))
        .limit(3)
        .all(),
    })),
  )
  const posts = lists.flatMap((list) => list.posts)
  const [postBlocks, categoryBlocks] = await Promise.all([
    blocksOf(
      ctx,
      locale,
      'post',
      posts.map((post) => post.id),
    ),
    blocksOf(
      ctx,
      locale,
      'category',
      categories.map((category) => category.id),
    ),
  ])
  const assets = await assetsOf(ctx, Object.values(postBlocks).flat())

  return lists.map(({ category, posts }) => (
    <section key={category.id} className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{category.name}</h2>
          <p className="text-stone-600">{textOf(categoryBlocks[category.id] ?? [], 'intro')}</p>
        </div>
        <Link
          href={`/${locale}/${category.slug}`}
          className="shrink-0 text-sm font-medium text-amber-700 underline underline-offset-2"
        >
          {t(locale).seeAll} ({category.postCount})
        </Link>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            href={`/${locale}/${category.slug}/${post.slug}`}
            blocks={postBlocks[post.id] ?? []}
            assets={assets}
            locale={locale}
          />
        ))}
      </div>
    </section>
  ))
}
