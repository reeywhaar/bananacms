import { getDb, type Metadata, type PageProps } from '@reeywhaar/bananacms'
import { CategoryStore, PostStore } from '@reeywhaar/bananacms/stores'
import { PostCard } from '@app/components/PostCard.tsx'
import { assetsOf, blocksOf } from '@app/lib/content.ts'
import { t } from '@app/lib/i18n.ts'
import { languages, localeOf } from '@app/lib/locale.ts'

type Props = PageProps<{ locale: string }>

export async function generateMetadata(props: Props): Promise<Metadata> {
  return {
    title: t(await localeOf(props.params)).search,
    alternates: { languages: languages('/search') },
  }
}

// The published posts whose texts in this language match ?q=, found with the
// posts' full-text index. The form works without JavaScript: it's a GET.
export default async function SearchPage(props: Props) {
  const locale = await localeOf(props.params)
  const { q } = await props.searchParams
  const query = (typeof q === 'string' ? q : '').trim()
  const strings = t(locale)
  const db = getDb(props.ctx)
  const [posts, categories] = await Promise.all([
    query
      ? new PostStore(db).query().locale(locale).textSearch(query).published().limit(24).all()
      : [],
    new CategoryStore(db).query().all(),
  ])
  const categorySlugs = new Map(categories.map((category) => [category.id, category.slug]))
  const blocks = await blocksOf(
    props.ctx,
    locale,
    'post',
    posts.map((post) => post.id),
  )
  const assets = await assetsOf(props.ctx, Object.values(blocks).flat())

  return (
    <>
      <form action={`/${locale}/search`} className="flex gap-2">
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder={strings.searchPlaceholder}
          aria-label={strings.search}
          className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2"
        />
        <button className="rounded-lg bg-amber-400 px-4 py-2 font-medium hover:bg-amber-300">
          {strings.search}
        </button>
      </form>
      {query && (
        <h1 className="text-xl font-semibold">
          {strings.searchResultsFor} “{query}”
        </h1>
      )}
      {query && posts.length === 0 && <p className="text-stone-600">{strings.searchNothing}</p>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            href={`/${locale}/${categorySlugs.get(post.categoryId)}/${post.slug}`}
            blocks={blocks[post.id] ?? []}
            assets={assets}
            locale={locale}
          />
        ))}
      </div>
    </>
  )
}
