import { getAuth, getDb, notFound, type Metadata, type PageProps } from '@reeywhaar/bananacms'
import { CategoryStore, PostStore } from '@reeywhaar/bananacms/stores'
import { Picture } from '@app/components/Picture.tsx'
import { PostCard } from '@app/components/PostCard.tsx'
import { assetsOf, blocksOf, pictureOf, textOf } from '@app/lib/content.ts'
import { languages, localeOf } from '@app/lib/locale.ts'

type Props = PageProps<{ locale: string; category: string }>

const findCategory = async (props: Props) => {
  const locale = await localeOf(props.params)
  const { category: slug } = await props.params
  const category = await new CategoryStore(getDb(props.ctx))
    .query()
    .bySlug(slug)
    .locale(locale)
    .first()
  if (!category) notFound()
  return { locale, category }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { category } = await findCategory(props)
  return { title: category.name, alternates: { languages: languages(`/${category.slug}`) } }
}

// a category's posts, in its order; drafts too for a signed-in user
export default async function CategoryPage(props: Props) {
  const { locale, category } = await findCategory(props)
  const signedIn = Boolean(getAuth(props.ctx))
  const posts = await new PostStore(getDb(props.ctx))
    .query()
    .inCategory({ id: category.id })
    .locale(locale)
    .map((query) => (signedIn ? query : query.published()))
    .all()
  const [postBlocks, categoryBlocks] = await Promise.all([
    blocksOf(
      props.ctx,
      locale,
      'post',
      posts.map((post) => post.id),
    ),
    blocksOf(props.ctx, locale, 'category', [category.id]),
  ])
  const intro = categoryBlocks[category.id] ?? []
  const cover = pictureOf(intro)
  const assets = await assetsOf(props.ctx, [...Object.values(postBlocks).flat(), ...intro])

  return (
    <>
      <header className="grid items-center gap-6 md:grid-cols-[1fr_16rem]">
        <div>
          <h1 className="text-3xl font-bold">{category.name}</h1>
          <p className="mt-2 text-lg text-stone-600">{textOf(intro, 'intro')}</p>
        </div>
        {cover && (
          <Picture
            block={cover}
            source={assets.images.get(cover.content.assetId)}
            locale={locale}
            imageClassName="aspect-[4/3] object-cover"
          />
        )}
      </header>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
    </>
  )
}
