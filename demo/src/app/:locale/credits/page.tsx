import { getDb, type Metadata, type PageProps } from '@reeywhaar/bananacms'
import { CategoryStore, PageStore, PostStore } from '@reeywhaar/bananacms/stores'
import { Picture } from '@app/components/Picture.tsx'
import { assetsOf, attributeOf, blocksOf, imagesIn, type ImageBlock } from '@app/lib/content.ts'
import { t } from '@app/lib/i18n.ts'
import { languages, localeOf } from '@app/lib/locale.ts'

type Props = PageProps<{ locale: string }>

export async function generateMetadata(props: Props): Promise<Metadata> {
  return {
    title: t(await localeOf(props.params)).credits,
    alternates: { languages: languages('/credits') },
  }
}

// Every image the site shows, with its credit: what the image blocks' attributes
// say about their authors and sources
export default async function CreditsPage(props: Props) {
  const locale = await localeOf(props.params)
  const db = getDb(props.ctx)
  const [posts, categories, pages] = await Promise.all([
    new PostStore(db).query().published().all(),
    new CategoryStore(db).query().all(),
    new PageStore(db).query().all(),
  ])
  const blocks = await Promise.all([
    blocksOf(
      props.ctx,
      locale,
      'post',
      posts.map((post) => post.id),
    ),
    blocksOf(
      props.ctx,
      locale,
      'category',
      categories.map((category) => category.id),
    ),
    blocksOf(
      props.ctx,
      locale,
      'page',
      pages.map((page) => page.id),
    ),
  ])
  const images = new Map<string, ImageBlock>()
  for (const image of imagesIn(blocks.flatMap((byParent) => Object.values(byParent).flat()))) {
    if (attributeOf(image, 'credit')) images.set(image.content.assetId, image)
  }
  const credited = [...images.values()]
  const assets = await assetsOf(props.ctx, credited)
  const strings = t(locale)

  return (
    <>
      <header>
        <h1 className="text-3xl font-bold">{strings.credits}</h1>
        <p className="mt-2 max-w-3xl text-stone-600">{strings.creditsIntro}</p>
      </header>
      <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {credited.map((image) => (
          <Picture
            key={image.content.assetId}
            block={image}
            source={assets.images.get(image.content.assetId)}
            locale={locale}
            imageClassName="aspect-[4/3] object-cover"
          />
        ))}
      </div>
    </>
  )
}
