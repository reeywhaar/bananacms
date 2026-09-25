import { getUrl, type Context, type Sitemap } from '@reeywhaar/bananacms'

export default function sitemap(ctx: Context): Sitemap {
  const origin = getUrl(ctx).origin
  return [
    { url: `${origin}/` },
    { url: `${origin}/posts/1?a=1&b=2`, lastModified: new Date('2026-01-02T03:04:05.000Z') },
  ]
}
