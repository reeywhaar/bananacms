import { getDb, getUrl, type Context, type Sitemap } from '@reeywhaar/bananacms'
import { CategoryStore, PostStore, TagStore } from '@reeywhaar/bananacms/stores'
import { locales } from '@app/lib/locale.ts'

// Served as /sitemap.xml, for search engines: each page in each language, the
// published posts, their categories and the tags
export default async function sitemap(ctx: Context): Promise<Sitemap> {
  const origin = getUrl(ctx).origin
  const db = getDb(ctx)
  const [categories, posts, tags] = await Promise.all([
    new CategoryStore(db).query().all(),
    new PostStore(db).query().published().all(),
    new TagStore(db).query().all(),
  ])
  const categorySlugs = new Map(categories.map((category) => [category.id, category.slug]))
  const paths = [
    '',
    ...categories.map((category) => `/${category.slug}`),
    ...posts.map((post) => `/${categorySlugs.get(post.categoryId)}/${post.slug}`),
    ...tags.map((tag) => `/tags/${tag.slug}`),
    '/search',
    '/credits',
  ]
  return locales.flatMap((locale) => paths.map((path) => ({ url: `${origin}/${locale}${path}` })))
}
