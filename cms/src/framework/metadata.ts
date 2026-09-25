// A page's metadata: its <title>, description, Open Graph tags, icons and the
// like. Pages, layouts and not-found pages declare it as in Next.js, by exporting
// `metadata`, or `generateMetadata(props, parent)`, which returns it
// (docs/routing.md#metadata). metadata-tags.tsx renders the result.

// Like Next's Metadata, for the fields sites use
export type Metadata = {
  // the base for relative URLs in `openGraph` and `alternates`
  metadataBase?: URL | null
  title?: Title | null
  description?: string | null
  keywords?: string | string[] | null
  authors?: Author | Author[] | null
  robots?: string | Robots | null
  alternates?: Alternates | null
  openGraph?: OpenGraph | null
  // a URL or a list of them is `icon`
  icons?: Icon | Icon[] | Icons | null
}

// A layout's `template`, like '%s | Site', wraps the titles of the layouts and
// pages in the folders below its own. `default` is the title for those that set
// none, and `absolute` is a title the templates above leave alone.
export type Title =
  | string
  | { default: string; template?: string | null }
  | { absolute: string; template?: string | null }

export type Author = { name?: string; url?: string | URL }

export type Robots = { index?: boolean; follow?: boolean }

export type Alternates = {
  canonical?: string | URL | null
  // by language code: `{ 'en-US': '/en' }`
  languages?: Record<string, string | URL>
  // by MIME type: `{ 'application/rss+xml': '/rss' }`
  types?: Record<string, string | URL>
}

export type OpenGraph = {
  title?: string
  description?: string
  url?: string | URL
  siteName?: string
  locale?: string
  type?: string
  images?: OpenGraphImage | OpenGraphImage[]
}

export type OpenGraphImage =
  | string
  | URL
  | {
      url: string | URL
      width?: number | string
      height?: number | string
      alt?: string
      type?: string
    }

export type Icon =
  string | URL | { url: string | URL; type?: string; sizes?: string; media?: string }

export type Icons = {
  icon?: Icon | Icon[]
  shortcut?: Icon | Icon[]
  apple?: Icon | Icon[]
}

// The metadata of a page's segments merged, with its title resolved
export type ResolvedMetadata = Omit<Metadata, 'title'> & {
  title: { absolute: string; template: string | null } | null
}

// What a generateMetadata() gets as its `parent`: the metadata of the layouts above
export type ResolvingMetadata = Promise<ResolvedMetadata>

// what a page, layout or not-found page exports besides its component
export type MetadataExports<Props> = {
  metadata?: Metadata
  generateMetadata?: (props: Props, parent: ResolvingMetadata) => Metadata | Promise<Metadata>
}

// The metadata of the segments merged so far. `template` is the title template
// for the segments below the last one, and `lastTemplate` the one that the last
// segment's own title went through.
export type MetadataChain = Promise<{
  metadata: ResolvedMetadata
  template: string | null
  lastTemplate: string | null
}>

export function emptyMetadataChain(): MetadataChain {
  return Promise.resolve({ metadata: { title: null }, template: null, lastTemplate: null })
}

// Adds a segment's metadata to `chain`: its keys replace those of the segments
// above, and its title goes through their template. Its generateMetadata()
// starts right away, with a promise of `chain` as its parent, so a page's
// segments resolve in parallel.
//
// A layout's template applies to the folders below its own, so a page in the
// same folder as the chain's last layout, `besideLast`, gets the template that
// layout got instead of the layout's own.
export function extendMetadata<Props>(
  chain: MetadataChain,
  segment: { exports: MetadataExports<Props>; props: Props; besideLast?: boolean },
): MetadataChain {
  const parent: ResolvingMetadata = chain.then((resolved) => resolved.metadata)
  // a generateMetadata() that ignores its parent leaves this promise unawaited,
  // and a rejection of `chain` still reaches the merged result below
  parent.catch(() => {})
  const { generateMetadata, metadata } = segment.exports
  const own = (async () =>
    generateMetadata ? await generateMetadata(segment.props, parent) : metadata)()
  return Promise.all([chain, own]).then(([above, own]) => {
    const template = segment.besideLast ? above.lastTemplate : above.template
    const merged = mergeMetadata(above.metadata, own, template)
    return { metadata: merged, template: merged.title?.template ?? null, lastTemplate: template }
  })
}

// A shallow merge, as in Next. A key set to `undefined` keeps what the segments
// above set, and `null` removes it.
function mergeMetadata(
  above: ResolvedMetadata,
  own: Metadata | undefined,
  template: string | null,
): ResolvedMetadata {
  if (!own) return above
  const { title, ...rest } = own
  const merged: ResolvedMetadata = { ...above }
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) Object.assign(merged, { [key]: value })
  }
  if (title !== undefined) merged.title = resolveTitle(title, template)
  return merged
}

function resolveTitle(title: Title | null, template: string | null): ResolvedMetadata['title'] {
  if (title === null) return null
  if (typeof title === 'string') return { absolute: applyTemplate(template, title), template: null }
  if ('absolute' in title) return { absolute: title.absolute, template: title.template ?? null }
  return { absolute: applyTemplate(template, title.default), template: title.template ?? null }
}

function applyTemplate(template: string | null, title: string): string {
  return template ? template.replaceAll('%s', title) : title
}
