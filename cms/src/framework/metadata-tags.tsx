import { Fragment, type ReactNode } from 'react'
import type { Icon, ResolvedMetadata } from './metadata.ts'

type ImageTags = {
  url: string
  width?: number | string
  height?: number | string
  alt?: string
  type?: string
}

// The tags for a page's metadata, in the order Next renders them. React hoists
// them into <head>.
//
// As in Next, `metadataBase` makes the URLs in `openGraph` and `alternates`
// absolute, and the Twitter card tags repeat the Open Graph ones.
export function MetadataTags({ metadata }: { metadata: ResolvedMetadata }): ReactNode {
  const base = metadata.metadataBase ?? null
  const { title, description, alternates, openGraph } = metadata
  const keywords = toArray(metadata.keywords)
  const robots = robotsContent(metadata.robots)
  const images = toArray(openGraph?.images).map((image): ImageTags =>
    typeof image === 'string' || image instanceof URL
      ? { url: absoluteUrl(image, base) }
      : { ...image, url: absoluteUrl(image.url, base) },
  )
  const twitterTitle = openGraph?.title || title?.absolute
  const twitterDescription = openGraph?.description || description

  return (
    <>
      {title && <title>{title.absolute}</title>}
      {description && <meta name="description" content={description} />}
      {toArray(metadata.authors).map((author, i) => (
        <Fragment key={i}>
          {author.url && <link rel="author" href={String(author.url)} />}
          {author.name && <meta name="author" content={author.name} />}
        </Fragment>
      ))}
      {keywords.length > 0 && <meta name="keywords" content={keywords.join(',')} />}
      {robots && <meta name="robots" content={robots} />}

      {alternates?.canonical && (
        <link rel="canonical" href={absoluteUrl(alternates.canonical, base)} />
      )}
      {Object.entries(alternates?.languages ?? {}).map(([language, url]) => (
        <link key={language} rel="alternate" hrefLang={language} href={absoluteUrl(url, base)} />
      ))}
      {Object.entries(alternates?.types ?? {}).map(([type, url]) => (
        <link key={type} rel="alternate" type={type} href={absoluteUrl(url, base)} />
      ))}

      {openGraph && (
        <>
          {openGraph.title && <meta property="og:title" content={openGraph.title} />}
          {openGraph.description && (
            <meta property="og:description" content={openGraph.description} />
          )}
          {openGraph.url && <meta property="og:url" content={absoluteUrl(openGraph.url, base)} />}
          {openGraph.siteName && <meta property="og:site_name" content={openGraph.siteName} />}
          {openGraph.locale && <meta property="og:locale" content={openGraph.locale} />}
          {images.map((image, i) => (
            <Fragment key={i}>
              <meta property="og:image" content={image.url} />
              {image.type && <meta property="og:image:type" content={image.type} />}
              {image.width !== undefined && (
                <meta property="og:image:width" content={String(image.width)} />
              )}
              {image.height !== undefined && (
                <meta property="og:image:height" content={String(image.height)} />
              )}
              {image.alt && <meta property="og:image:alt" content={image.alt} />}
            </Fragment>
          ))}
          {openGraph.type && <meta property="og:type" content={openGraph.type} />}

          <meta
            name="twitter:card"
            content={images.length > 0 ? 'summary_large_image' : 'summary'}
          />
          {twitterTitle && <meta name="twitter:title" content={twitterTitle} />}
          {twitterDescription && <meta name="twitter:description" content={twitterDescription} />}
          {images.map((image, i) => (
            <Fragment key={i}>
              <meta name="twitter:image" content={image.url} />
              {image.alt && <meta name="twitter:image:alt" content={image.alt} />}
            </Fragment>
          ))}
        </>
      )}

      {iconLinks(metadata.icons).map(({ rel, icon }, i) => {
        const { url, ...attributes } =
          typeof icon === 'string' || icon instanceof URL ? { url: icon } : icon
        return <link key={i} rel={rel} href={String(url)} {...attributes} />
      })}
    </>
  )
}

// A URL made absolute against `base`, as Next does it: a path joins the base's own
// path, so '/rss' on 'https://site.test/blog/' is 'https://site.test/blog/rss'.
// Without a base, a relative URL stays as it is.
function absoluteUrl(url: string | URL, base: URL | null): string {
  if (url instanceof URL) return url.href
  if (!base || URL.canParse(url)) return url
  return new URL(`${base.pathname.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`, base).href
}

function robotsContent(robots: ResolvedMetadata['robots']): string | undefined {
  if (!robots || typeof robots === 'string') return robots ?? undefined
  const values = []
  if (robots.index !== undefined) values.push(robots.index ? 'index' : 'noindex')
  if (robots.follow !== undefined) values.push(robots.follow ? 'follow' : 'nofollow')
  return values.join(', ') || undefined
}

function iconLinks(icons: ResolvedMetadata['icons']): { rel: string; icon: Icon }[] {
  if (!icons) return []
  if (Array.isArray(icons) || typeof icons === 'string' || icons instanceof URL || 'url' in icons) {
    return toArray(icons).map((icon) => ({ rel: 'icon', icon }))
  }
  return [
    ...toArray(icons.shortcut).map((icon) => ({ rel: 'shortcut icon', icon })),
    ...toArray(icons.icon).map((icon) => ({ rel: 'icon', icon })),
    ...toArray(icons.apple).map((icon) => ({ rel: 'apple-touch-icon', icon })),
  ]
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return []
  return Array.isArray(value) ? value : [value]
}
