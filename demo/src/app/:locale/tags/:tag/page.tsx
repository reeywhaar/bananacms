import { getAuth, getDb, notFound, type Metadata, type PageProps } from '@reeywhaar/bananacms'
import { CategoryStore, PostStore, TagStore } from '@reeywhaar/bananacms/stores'
import { PostCard } from '@app/components/PostCard.tsx'
import { assetsOf, blocksOf, textOf } from '@app/lib/content.ts'
import { languages, localeOf } from '@app/lib/locale.ts'

type Props = PageProps<{ locale: string; tag: string }>

const findTag = async (props: Props) => {
  const locale = await localeOf(props.params)
  const { tag: slug } = await props.params
  const tag = await new TagStore(getDb(props.ctx)).query().bySlug(slug).locale(locale).first()
  if (!tag) notFound()
  return { locale, tag }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { tag } = await findTag(props)
  return { title: tag.name, alternates: { languages: languages(`/tags/${tag.slug}`) } }
}

// a tag's description, and the posts with it, from any category
export default async function TagPage(props: Props) {
  const { locale, tag } = await findTag(props)
  const db = getDb(props.ctx)
  const signedIn = Boolean(getAuth(props.ctx))
  const [posts, categories] = await Promise.all([
    new PostStore(db)
      .query()
      .withTag({ id: tag.id })
      .locale(locale)
      .map((query) => (signedIn ? query : query.published()))
      .all(),
    new CategoryStore(db).query().all(),
  ])
  const categorySlugs = new Map(categories.map((category) => [category.id, category.slug]))
  const [postBlocks, tagBlocks] = await Promise.all([
    blocksOf(
      props.ctx,
      locale,
      'post',
      posts.map((post) => post.id),
    ),
    blocksOf(props.ctx, locale, 'tag', [tag.id]),
  ])
  const assets = await assetsOf(props.ctx, Object.values(postBlocks).flat())

  return (
    <>
      <header>
        <h1 className="text-3xl font-bold">{tag.name}</h1>
        <p className="mt-2 text-lg text-stone-600">
          {textOf(tagBlocks[tag.id] ?? [], 'description')}
        </p>
      </header>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            href={`/${locale}/${categorySlugs.get(post.categoryId)}/${post.slug}`}
            blocks={postBlocks[post.id] ?? []}
            assets={assets}
            locale={locale}
          />
        ))}
      </div>
    </>
  )
}
