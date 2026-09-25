import type { ReactNode } from 'react'
import type { Context } from './context.ts'
import type { MetadataExports } from './metadata.ts'
import type { RouteHandlers } from './route-handlers.ts'
import type { Sitemap } from './sitemap.ts'
import type { ErrorComponent } from './error-boundary.tsx'
import { createRoutes, findRoute, folderFiles, type Params, type Route } from './route-table.ts'

// The site's file routes: src/app/**/page.tsx, layout.tsx, error.tsx and
// not-found.tsx, global-not-found.tsx, and the route.ts and sitemap.ts files (the
// scheme is in docs/routing.md).

export type { Params } from './route-table.ts'
export type SearchParams = Record<string, string | string[]>

// `ctx` is the request's context (docs/context.md). As in Next 15+, params and
// searchParams are promises.
export type PageProps<P extends Params = Params> = {
  ctx: Context
  params: Promise<P>
  searchParams: Promise<SearchParams>
}

export type LayoutProps<P extends Params = Params> = {
  ctx: Context
  params: Promise<P>
  children: ReactNode
}

// what a layout's or not-found page's generateMetadata() gets
export type SegmentProps<P extends Params = Params> = Omit<LayoutProps<P>, 'children'>

export type PageComponent = (props: PageProps) => ReactNode
export type LayoutComponent = (props: LayoutProps) => ReactNode
export type NotFoundComponent = (props: { ctx: Context }) => ReactNode

// a page.tsx, layout.tsx or not-found.tsx: its component, and its metadata
export type PageModule = { default: PageComponent } & MetadataExports<PageProps>
export type LayoutModule = { default: LayoutComponent } & MetadataExports<SegmentProps>
export type NotFoundModule = { default: NotFoundComponent } & MetadataExports<SegmentProps>
export type SitemapModule = { default: (ctx: Context) => Sitemap | Promise<Sitemap> }
export type ErrorModule = { default: ErrorComponent }

// lazy imports: each page and layout is its own chunk
const pages = import.meta.glob<PageModule>('/src/app/**/page.tsx')
const layouts = import.meta.glob<LayoutModule>('/src/app/**/layout.tsx')
const errorPages = import.meta.glob<ErrorModule>('/src/app/**/error.tsx')
const notFoundPages = import.meta.glob<NotFoundModule>('/src/app/**/not-found.tsx')
const globalNotFoundPages = import.meta.glob<NotFoundModule>('/src/app/global-not-found.tsx')
const handlers = import.meta.glob<RouteHandlers>('/src/app/**/route.ts')
const sitemaps = import.meta.glob<SitemapModule>('/src/app/**/sitemap.ts')

const routes = createRoutes([
  ...Object.keys(pages),
  ...Object.keys(handlers),
  ...Object.keys(sitemaps),
])

export type RouteMatch = { route: Route; params: Params }

export function matchRoute(pathname: string): RouteMatch | undefined {
  return findRoute(routes, pathname)
}

export function loadPage(route: Route): Promise<PageModule> {
  return pages[route.file]()
}

export function loadRouteHandlers(route: Route): Promise<RouteHandlers> {
  return handlers[route.file]()
}

export function loadSitemap(route: Route): Promise<SitemapModule> {
  return sitemaps[route.file]()
}

// a layout.tsx or error.tsx around a page, with its depth: how many folders below
// src/app it is
export type FolderFile<Module> = { file: string; module: Module; depth: number }

// the layouts around a page in `folders`, outermost first
export function loadLayouts(folders: string[]): Promise<FolderFile<LayoutModule>[]> {
  return loadFolderFiles(layouts, folders, 'layout.tsx')
}

// the error.tsx files around a page in `folders`, outermost first
export function loadErrorPages(folders: string[]): Promise<FolderFile<ErrorModule>[]> {
  return loadFolderFiles(errorPages, folders, 'error.tsx')
}

function loadFolderFiles<Module>(
  modules: Record<string, () => Promise<Module>>,
  folders: string[],
  name: string,
): Promise<FolderFile<Module>[]> {
  return Promise.all(
    folderFiles(folders, name, (file) => file in modules).map(async ({ file, depth }) => ({
      file,
      module: await modules[file](),
      depth,
    })),
  )
}

// the not-found.tsx closest to a page in `folders`: in its folder, or the nearest
// one above
export async function loadNotFound(
  folders: string[],
): Promise<FolderFile<NotFoundModule> | undefined> {
  const nearest = folderFiles(folders, 'not-found.tsx', (file) => file in notFoundPages).at(-1)
  return nearest && { ...nearest, module: await notFoundPages[nearest.file]() }
}

export async function loadGlobalNotFound(): Promise<NotFoundModule | undefined> {
  return globalNotFoundPages['/src/app/global-not-found.tsx']?.()
}
