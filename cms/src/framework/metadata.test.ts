import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MetadataTags } from './metadata-tags.tsx'
import {
  emptyMetadataChain,
  extendMetadata,
  type Metadata,
  type MetadataChain,
  type MetadataExports,
  type ResolvedMetadata,
} from './metadata.ts'
import { notFound } from './not-found.ts'

// Chains segments as app.tsx does, each one in a folder below the one before,
// unless it's marked as a page beside the last layout, in its folder
function chain(
  ...segments: (Metadata | MetadataExports<{}> | { beside: Metadata })[]
): MetadataChain {
  return segments.reduce<MetadataChain>((above, segment) => {
    if ('beside' in segment) {
      return extendMetadata(above, {
        exports: { metadata: segment.beside },
        props: {},
        besideLast: true,
      })
    }
    const exports =
      'metadata' in segment || 'generateMetadata' in segment
        ? (segment as MetadataExports<{}>)
        : { metadata: segment as Metadata }
    return extendMetadata(above, { exports, props: {} })
  }, emptyMetadataChain())
}

const resolve = async (...segments: Parameters<typeof chain>) => (await chain(...segments)).metadata
const render = (metadata: ResolvedMetadata) =>
  renderToStaticMarkup(createElement(MetadataTags, { metadata })).replaceAll('><', '>\n<')

describe('metadata', () => {
  it("replaces an earlier segment's keys with a later one's, keeps them for undefined, and drops them for null", async () => {
    const metadata = await resolve(
      { description: 'Site', keywords: ['a'], openGraph: { title: 'Site', description: 'All' } },
      { description: undefined, keywords: null, openGraph: { title: 'Post' } },
    )
    expect(metadata.description).toBe('Site')
    expect(metadata.keywords).toBeNull()
    // shallow: the page's openGraph replaces the layout's whole
    expect(metadata.openGraph).toEqual({ title: 'Post' })
  })

  it('wraps the titles below a layout in its template, and uses its default when they set none', async () => {
    const layout: Metadata = { title: { template: '%s | Site', default: 'Site' } }
    expect((await resolve(layout, { title: 'Post' })).title?.absolute).toBe('Post | Site')
    expect((await resolve(layout, {})).title?.absolute).toBe('Site')
    expect((await resolve(layout, { title: { absolute: 'Just this' } })).title?.absolute).toBe(
      'Just this',
    )
  })

  it("leaves a page in a layout's own folder out of its template", async () => {
    const root: Metadata = { title: { template: '%s | Site', default: 'Site' } }
    expect((await resolve(root, { beside: { title: 'Home' } })).title?.absolute).toBe('Home')
    expect((await resolve(root, { beside: {} })).title?.absolute).toBe('Site')
    // the layout's own template still wraps it
    const blog: Metadata = { title: { template: '%s | Blog', default: 'Blog' } }
    expect((await resolve(root, blog, { beside: { title: 'Index' } })).title?.absolute).toBe(
      'Index | Site',
    )
    expect((await resolve(root, blog, { title: 'Post' })).title?.absolute).toBe('Post | Blog')
  })

  it("applies a nested layout's template over the root's, and stops the root's at a plain title", async () => {
    const root: Metadata = { title: { template: '%s | Site', default: 'Site' } }
    expect(
      (
        await resolve(
          root,
          { title: { template: '%s | Blog | Site', default: 'Blog' } },
          { title: 'Post' },
        )
      ).title?.absolute,
    ).toBe('Post | Blog | Site')
    // Next's rule: a layout with a plain title has no template for the segments below
    expect((await resolve(root, { title: 'Blog' }, { title: 'Post' })).title?.absolute).toBe('Post')
  })

  it('calls every generateMetadata() at once, each with its props and the metadata above as its parent', async () => {
    const started: string[] = []
    const { promise: layoutDone, resolve: finishLayout } = Promise.withResolvers<Metadata>()
    const layout: MetadataExports<{ id: string }> = {
      generateMetadata: () => {
        started.push('layout')
        return layoutDone
      },
    }
    const page: MetadataExports<{ id: string }> = {
      generateMetadata: async ({ id }, parent) => {
        started.push('page')
        return { title: `${id} under ${(await parent).title?.absolute}` }
      },
    }
    const layouts = extendMetadata(emptyMetadataChain(), { exports: layout, props: { id: 'post' } })
    const result = extendMetadata(layouts, { exports: page, props: { id: 'post' } })
    await Promise.resolve()
    expect(started).toEqual(['layout', 'page'])
    finishLayout({ title: 'Blog' })
    expect((await result).metadata.title?.absolute).toBe('post under Blog')
  })

  it("rejects with a layout's notFound(), including below a segment that ignores its parent", async () => {
    const result = chain(
      { generateMetadata: () => notFound() },
      { generateMetadata: () => ({ title: 'Post' }) },
    )
    await expect(result).rejects.toThrow('Not found')
  })
})

describe('MetadataTags', () => {
  // vyrtsev-bananacms's root layout, which renders the tags below under Next.js
  const siteLayout: Metadata = {
    metadataBase: new URL('https://vyrtsev.com'),
    title: { template: '%s | Vyrtsev.com', default: 'Vyrtsev, Reeywhaar and Me' },
    description: 'Works by Misha Vyrtsev. Watercolors.',
    keywords: [
      'Misha Vyrtsev',
      'Reeywhaar',
      'Reey Whaar',
      'Watercolor',
      'Watercolor Artist',
      'Painting',
    ],
    authors: [{ name: 'Misha Vyrtsev' }],
    icons: { icon: '/assets/horrorse.ico', apple: '/assets/horrorse2k-400.png' },
    openGraph: {
      title: 'Vyrtsev, Reeywhaar and Me',
      description: 'Works by Misha Vyrtsev. Watercolors.',
      images: [{ url: '/assets/horrorse2k-400.png' }],
    },
    alternates: { types: { 'application/rss+xml': 'https://vyrtsev.com/rss' } },
  }
  const nextTags = (title: string) =>
    [
      `<title>${title}</title>`,
      '<meta name="description" content="Works by Misha Vyrtsev. Watercolors."/>',
      '<meta name="author" content="Misha Vyrtsev"/>',
      '<meta name="keywords" content="Misha Vyrtsev,Reeywhaar,Reey Whaar,Watercolor,Watercolor Artist,Painting"/>',
      '<link rel="alternate" type="application/rss+xml" href="https://vyrtsev.com/rss"/>',
      '<meta property="og:title" content="Vyrtsev, Reeywhaar and Me"/>',
      '<meta property="og:description" content="Works by Misha Vyrtsev. Watercolors."/>',
      '<meta property="og:image" content="https://vyrtsev.com/assets/horrorse2k-400.png"/>',
      '<meta name="twitter:card" content="summary_large_image"/>',
      '<meta name="twitter:title" content="Vyrtsev, Reeywhaar and Me"/>',
      '<meta name="twitter:description" content="Works by Misha Vyrtsev. Watercolors."/>',
      '<meta name="twitter:image" content="https://vyrtsev.com/assets/horrorse2k-400.png"/>',
      '<link rel="icon" href="/assets/horrorse.ico"/>',
      '<link rel="apple-touch-icon" href="/assets/horrorse2k-400.png"/>',
    ].join('\n')

  it("renders the site's tags as Next does, on its home page and on a post", async () => {
    expect(render(await resolve(siteLayout, { beside: {} }))).toBe(
      nextTags('Vyrtsev, Reeywhaar and Me'),
    )
    expect(render(await resolve(siteLayout, { title: 'Bravo' }))).toBe(
      nextTags('Bravo | Vyrtsev.com'),
    )
  })

  it("joins relative URLs to metadataBase's path, and leaves them relative without one", async () => {
    const page: Metadata = {
      alternates: { canonical: '/posts/1', languages: { ru: '/ru/posts/1' } },
      openGraph: { url: 'posts/1', images: 'https://cdn.test/a.png' },
    }
    expect(render(await resolve({ metadataBase: new URL('https://site.test/blog/') }, page))).toBe(
      [
        '<link rel="canonical" href="https://site.test/blog/posts/1"/>',
        '<link rel="alternate" hrefLang="ru" href="https://site.test/blog/ru/posts/1"/>',
        '<meta property="og:url" content="https://site.test/blog/posts/1"/>',
        '<meta property="og:image" content="https://cdn.test/a.png"/>',
        '<meta name="twitter:card" content="summary_large_image"/>',
        '<meta name="twitter:image" content="https://cdn.test/a.png"/>',
      ].join('\n'),
    )
    expect(render(await resolve(page))).toContain('<link rel="canonical" href="/posts/1"/>')
  })

  it('renders robots, author links, image details and icon attributes', async () => {
    const metadata = await resolve({
      robots: { index: false, follow: true },
      authors: { name: 'Ann', url: 'https://ann.test' },
      openGraph: {
        type: 'article',
        images: { url: 'https://site.test/a.png', width: 800, alt: 'A' },
      },
      icons: [{ url: '/icon.svg', type: 'image/svg+xml' }, '/icon.png'],
    })
    expect(render(metadata)).toBe(
      [
        '<link rel="author" href="https://ann.test"/>',
        '<meta name="author" content="Ann"/>',
        '<meta name="robots" content="noindex, follow"/>',
        '<meta property="og:image" content="https://site.test/a.png"/>',
        '<meta property="og:image:width" content="800"/>',
        '<meta property="og:image:alt" content="A"/>',
        '<meta property="og:type" content="article"/>',
        '<meta name="twitter:card" content="summary_large_image"/>',
        '<meta name="twitter:image" content="https://site.test/a.png"/>',
        '<meta name="twitter:image:alt" content="A"/>',
        '<link rel="icon" href="/icon.svg" type="image/svg+xml"/>',
        '<link rel="icon" href="/icon.png"/>',
      ].join('\n'),
    )
  })

  it('renders nothing for empty metadata', async () => {
    expect(render(await resolve())).toBe('')
  })
})
