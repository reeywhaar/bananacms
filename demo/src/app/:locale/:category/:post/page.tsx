import { getAuth, getDb, notFound, type Metadata, type PageProps } from '@reeywhaar/bananacms'
import { Link } from '@reeywhaar/bananacms/client'
import { AttributeStore, CategoryStore, PostStore, TagStore } from '@reeywhaar/bananacms/stores'
import { Attributes } from '@app/components/Attributes.tsx'
import { Blocks } from '@app/components/Blocks.tsx'
import { Picture } from '@app/components/Picture.tsx'
import { assetsOf, blocksOf, pictureOf, textOf } from '@app/lib/content.ts'
import { t } from '@app/lib/i18n.ts'
import { languages, localeOf } from '@app/lib/locale.ts'

type Props = PageProps<{ locale: string; category: string; post: string }>

// the post, in its category; a draft only for a signed-in user
const findPost = async (props: Props) => {
  const locale = await localeOf(props.params)
  const { category: categorySlug, post: slug } = await props.params
  const db = getDb(props.ctx)
  const [category, post] = await Promise.all([
    new CategoryStore(db).query().bySlug(categorySlug).locale(locale).first(),
    new PostStore(db)
      .query()
      .inCategory({ slug: categorySlug })
      .bySlug(slug)
      .locale(locale)
      .first(),
  ])
  if (!category || !post || (post.status === 'draft' && !getAuth(props.ctx))) notFound()
  return { locale, category, post }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, category, post } = await findPost(props)
  const blocks = (await blocksOf(props.ctx, locale, 'post', [post.id]))[post.id] ?? []
  return {
    title: post.name,
    description: textOf(blocks, 'summary'),
    alternates: { languages: languages(`/${category.slug}/${post.slug}`) },
  }
}

// A post: its picture and summary, then the rest of its blocks, with its
// attributes and tags up top
export default async function PostPage(props: Props) {
  const { locale, category, post } = await findPost(props)
  const db = getDb(props.ctx)
  const [blocksById, attributes, tags] = await Promise.all([
    blocksOf(props.ctx, locale, 'post', [post.id]),
    new AttributeStore(db).query().parentedBy({ table: 'post', id: post.id }).locale(locale).all(),
    new TagStore(db).query().taggedTo({ table: 'post', id: post.id }).locale(locale).all(),
  ])
  const blocks = blocksById[post.id] ?? []
  const picture = pictureOf(blocks)
  const summary = blocks.find((block) => block.content.key === 'summary')
  const assets = await assetsOf(props.ctx, blocks)
  const strings = t(locale)

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-3">
        <Link href={`/${locale}/${category.slug}`} className="text-sm text-amber-700 underline">
          {category.name}
        </Link>
        <h1 className="text-4xl font-bold">
          {post.name}
          {post.status === 'draft' && (
            <span className="ml-3 rounded bg-stone-200 px-2 py-0.5 align-middle text-sm font-normal text-stone-600">
              {strings.draft}
            </span>
          )}
        </h1>
        <Attributes attributes={attributes} locale={locale} />
        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label={strings.tags}>
            {tags.map((tag) => (
              <li key={tag.id}>
                <Link
                  href={`/${locale}/tags/${tag.slug}`}
                  className="rounded-full bg-amber-200/70 px-2.5 py-0.5 text-sm hover:bg-amber-300"
                >
                  {tag.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </header>
      {picture && (
        <Picture
          block={picture}
          source={assets.images.get(picture.content.assetId)}
          locale={locale}
        />
      )}
      {summary?.content.type === 'text' && (
        <p className="text-xl leading-relaxed text-stone-700">{summary.content.text}</p>
      )}
      <Blocks
        blocks={blocks.filter((block) => block !== picture && block !== summary)}
        assets={assets}
        locale={locale}
      />
    </article>
  )
}
