import { Fragment, type ReactNode } from 'react'
import type { Context } from './context.ts'
import { getUrl } from './context.ts'
import { ErrorBoundary, type ErrorComponent } from './error-boundary.tsx'
import { MetadataTags } from './metadata-tags.tsx'
import {
  emptyMetadataChain,
  extendMetadata,
  type MetadataChain,
  type ResolvedMetadata,
} from './metadata.ts'
import { isNotFoundError } from './not-found.ts'
import { redirectTarget } from './redirect.ts'
import { renderRoute } from './render-route.tsx'
import { isManagePath, isNojs, MANAGE_PATH, toNojsUrl } from './request.ts'
import {
  loadErrorPages,
  loadGlobalNotFound,
  loadLayouts,
  loadNotFound,
  loadPage,
  type ErrorModule,
  type NotFoundModule,
  type RouteMatch,
  type SearchParams,
} from './routes.ts'

// What to render for a request: the CMS admin under /manage, and the site's file
// route that `match`ed (routes.ts) for everything else.
//
// The admin and the site's pages and layouts are all imported lazily, so each is
// its own chunk of the server build with its own stylesheet, and each app gets
// only its own styles.
export async function renderApp(
  ctx: Context,
  match: RouteMatch | undefined,
): Promise<{ root: ReactNode; status: number; rootLayout: string }> {
  const url = getUrl(ctx)
  if (isManagePath(url.pathname)) {
    const { ManageApp } = await import('../screens/Manage/ManageApp.tsx')
    return { root: <ManageApp ctx={ctx} />, status: 200, rootLayout: MANAGE_PATH }
  }

  const folders = match?.route.folders ?? []
  const [page, layouts, errorPages, nearestNotFound, globalNotFound] = await Promise.all([
    match && loadPage(match.route),
    loadLayouts(folders),
    loadErrorPages(folders),
    loadNotFound(folders),
    match ? undefined : loadGlobalNotFound(),
  ])
  if (globalNotFound) return renderGlobalNotFound(ctx, globalNotFound)

  const notFound = nearestNotFound ?? { file: '', module: DEFAULT_NOT_FOUND, depth: 0 }
  const NotFound = notFound.module.default
  const params = Promise.resolve(match?.params ?? {})
  const searchParams = Promise.resolve(toSearchParams(url))
  const segmentProps = { ctx, params }
  const pageProps = { ctx, params, searchParams }

  // the metadata down to each layout, one chain after another, all started at once
  const layoutChains: MetadataChain[] = []
  for (const layout of layouts) {
    const above = layoutChains.at(-1) ?? emptyMetadataChain()
    layoutChains.push(extendMetadata(above, { exports: layout.module, props: segmentProps }))
  }
  // The not-found page's metadata, under that of the layouts down to its folder,
  // unless one of those is what called notFound(). Their templates all wrap its
  // title, as in Next.
  const notFoundMetadata = async () => {
    const around = layouts.findLastIndex((layout) => layout.depth <= notFound.depth)
    const above = layoutChains[around] ?? emptyMetadataChain()
    const chain = (await metadataOrNotFound(above)) ? above : emptyMetadataChain()
    return (await extendMetadata(chain, { exports: notFound.module, props: segmentProps })).metadata
  }

  // Metadata resolves before rendering, so a notFound() or redirect() from a
  // generateMetadata() decides the response, client navigation included: a 404,
  // or a redirect, which the redirects middleware sends (cms-middleware.ts). Any
  // other error it throws renders in the page's place, for an error.tsx to catch.
  const outcome: PageOutcome = page
    ? await pageOutcome(
        extendMetadata(layoutChains.at(-1) ?? emptyMetadataChain(), {
          exports: page,
          props: pageProps,
          besideLast: layouts.at(-1)?.depth === folders.length,
        }),
      )
    : { kind: 'notFound' }

  // Wraps `content` in the layouts and error.tsx files from src/app down to the
  // folder at `depth`, as in Next: a folder's error.tsx catches what throws below
  // its layout, and the layout wraps it. The outermost layout, the root one, which
  // renders <html>, also gets the document's tags, outside the error boundaries, so
  // an error page has them too.
  function inLayouts(content: ReactNode, depth: number): { tree: ReactNode; rootLayout: string } {
    const around = layouts.filter((layout) => layout.depth <= depth)
    const documentTags = (
      <>
        {DOCUMENT_TAGS}
        {/* streamed content replaces its fallbacks through JavaScript, so browsers
            with it off reload into no-JS mode, which sends the full page */}
        {!isNojs(url) && (
          <noscript>
            <meta httpEquiv="refresh" content={`0; url=${toNojsUrl(url)}`} />
          </noscript>
        )}
      </>
    )
    // keyed by path: navigating mounts fresh Suspense boundaries, so the new page
    // shows its fallbacks right away
    let tree = <Fragment key={url.pathname}>{content}</Fragment>
    for (let folder = depth; folder >= 0; folder--) {
      const errorPage = errorPages.find((file) => file.depth === folder)
      if (errorPage) {
        tree = <ErrorBoundary errorComponent={errorComponent(errorPage)}>{tree}</ErrorBoundary>
      }
      const layout = around.find((file) => file.depth === folder)
      if (layout) {
        const Layout = layout.module.default
        tree = (
          <Layout ctx={ctx} params={params}>
            {layout === around[0] ? (
              <>
                {documentTags}
                {tree}
              </>
            ) : (
              tree
            )}
          </Layout>
        )
      }
    }
    if (!around[0]) {
      tree = (
        <DefaultRootLayout>
          {documentTags}
          {tree}
        </DefaultRootLayout>
      )
    }
    return { tree, rootLayout: around[0]?.file ?? 'default' }
  }

  // A URL with no route, or a page whose metadata called notFound(): the
  // not-found page closest to it, inside the layouts down to its folder
  if (!page || outcome.kind === 'notFound') {
    const metadata = await notFoundMetadata()
    const { tree, rootLayout } = inLayouts(
      <>
        <MetadataTags metadata={metadata} />
        <NotFound ctx={ctx} />
      </>,
      notFound.depth,
    )
    return { root: tree, status: 404, rootLayout }
  }

  // The page renders through this wrapper, which catches a notFound() or
  // redirect() from its own body (renderRoute). A not-found page for that renders
  // in the page's place, inside all of its layouts, since they have rendered.
  const Page = page.default
  const PageRoot = async () => {
    if (outcome.kind === 'error') throw outcome.error
    return renderRoute(
      ctx,
      async () => (
        <>
          <MetadataTags metadata={outcome.metadata} />
          {await Page(pageProps)}
        </>
      ),
      async () => (
        <>
          <MetadataTags metadata={await notFoundMetadata()} />
          <NotFound ctx={ctx} />
        </>
      ),
    )
  }

  const { tree, rootLayout } = inLayouts(<PageRoot />, folders.length)
  return { root: tree, status: outcome.kind === 'error' ? 500 : 200, rootLayout }
}

// A URL with no route, on a site with a src/app/global-not-found.tsx: that's the
// whole document, with no layouts around it, as in Next. It renders <html>
// itself, and its metadata is its own.
async function renderGlobalNotFound(
  ctx: Context,
  module: NotFoundModule,
): Promise<{ root: ReactNode; status: number; rootLayout: string }> {
  const props = { ctx, params: Promise.resolve({}) }
  const { metadata } = await extendMetadata(emptyMetadataChain(), { exports: module, props })
  const GlobalNotFound = module.default
  return {
    root: (
      <>
        {DOCUMENT_TAGS}
        <MetadataTags metadata={metadata} />
        <GlobalNotFound ctx={ctx} />
      </>
    ),
    status: 404,
    rootLayout: '/src/app/global-not-found.tsx',
  }
}

// What a page's metadata decides: the page, the not-found page in its place, or
// an error, which renders in the page's place for an error.tsx. A redirect()
// is thrown on, for the redirects middleware.
type PageOutcome =
  | { kind: 'page'; metadata: ResolvedMetadata }
  | { kind: 'notFound' }
  | { kind: 'error'; error: unknown }

async function pageOutcome(chain: MetadataChain): Promise<PageOutcome> {
  try {
    return { kind: 'page', metadata: (await chain).metadata }
  } catch (error) {
    if (isNotFoundError(error)) return { kind: 'notFound' }
    if (redirectTarget(error)) throw error
    return { kind: 'error', error }
  }
}

// React hoists these into <head>
const DOCUMENT_TAGS = (
  <>
    <meta charSet="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </>
)

// An error.tsx's component. It renders in the browser, where it catches what
// throws, so the file needs 'use client', as in Next.
function errorComponent({ file, module }: { file: string; module: ErrorModule }): ErrorComponent {
  const component = module.default as ErrorComponent & { $$typeof?: symbol }
  if (component.$$typeof !== Symbol.for('react.client.reference')) {
    throw new Error(`${file} needs 'use client' at its top: an error page is a client component`)
  }
  return component
}

// the chain's metadata, or undefined when a segment called notFound()
async function metadataOrNotFound(chain: MetadataChain): Promise<ResolvedMetadata | undefined> {
  try {
    return (await chain).metadata
  } catch (error) {
    if (isNotFoundError(error)) return undefined
    throw error
  }
}

// like Next's searchParams: repeated keys become arrays
function toSearchParams(url: URL): SearchParams {
  const searchParams: SearchParams = {}
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key)
    searchParams[key] = values.length === 1 ? values[0] : values
  }
  return searchParams
}

// defaults for src/app/layout.tsx and src/app/not-found.tsx

function DefaultRootLayout(props: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{props.children}</body>
    </html>
  )
}

const DEFAULT_NOT_FOUND: NotFoundModule = {
  default: () => <h1>404: This page could not be found.</h1>,
  metadata: { title: 'Not found' },
}
