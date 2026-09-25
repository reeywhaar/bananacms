# Routing

A site's routes are files under `src/app/`. Every `page.tsx` is a page, and the path of its folder is its URL.

## Files

| File                   | Role                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `page.tsx`             | A page. Its default export renders it.                                                                               |
| `layout.tsx`           | Wraps the pages in its folder and in the folders below it.                                                           |
| `not-found.tsx`        | The 404 page for its folder and the folders below. See [Not found](#not-found) below.                                |
| `error.tsx`            | The error page for what throws below its folder's layout. See [Errors](#errors).                                     |
| `global-not-found.tsx` | The 404 document for URLs with no route, in `src/app/` itself. See [Not found](#not-found).                          |
| `global-error.tsx`     | The error page for the whole document, in `src/app/` itself. See [Errors](#errors).                                  |
| `route.ts`             | Answers its folder's URL with a function per HTTP method, in place of a page. See [Route handlers](#route-handlers). |
| `sitemap.ts`           | Serves `sitemap.xml` in its folder. See [Sitemaps](#sitemaps).                                                       |

Pages, layouts and not-found pages can also export their [metadata](#metadata): the page's title and other `<head>` tags.

## Folder names

Folder names use [URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) syntax, and compile to exactly that pattern.

| Page file                        | Matches                | `params`                                  |
| -------------------------------- | ---------------------- | ----------------------------------------- |
| `src/app/page.tsx`               | `/`                    | `{}`                                      |
| `src/app/posts/page.tsx`         | `/posts`               | `{}`                                      |
| `src/app/posts/:id/page.tsx`     | `/posts/abc`           | `{ id: 'abc' }`                           |
| `src/app/docs/:slug+/page.tsx`   | `/docs/a`, `/docs/a/b` | `{ slug: ['a'] }`, `{ slug: ['a', 'b'] }` |
| `src/app/shop/:path*/page.tsx`   | `/shop`, `/shop/a/b`   | `{}`, `{ path: ['a', 'b'] }`              |
| `src/app/(admin)/users/page.tsx` | `/users`               | `{}`                                      |

- `:name` matches one segment.
- `:name+` matches one or more segments, and `:name*` zero or more. Both give an array of segments.
- `(name)` folders group routes, usually to share a layout, and stay out of the URL.
- Any other folder name is literal, including characters like `+`: `src/app/a+b/page.tsx` matches `/a+b`.
- Param names are letters, digits and underscores.
- Params are percent-decoded: `/posts/a%20b` gives `{ id: 'a b' }`. A malformed escape like `/posts/%E0%A4` gets the not-found page.
- A trailing slash is ignored: `/posts/` is `/posts`.
- A Next.js-style folder such as `[id]` stops the app with an error pointing here. See [Migrating from Next.js](#migrating-from-nextjs).

`:` and `*` work in folder names on macOS and Linux. Windows file names can't contain them.

### Precedence

When several routes match a URL, the most specific one wins. Comparing folder by folder from the top, a literal folder beats `:name`, which beats `:name+`, which beats `:name*`. So with both `posts/new/page.tsx` and `posts/:id/page.tsx`, `/posts/new` goes to the first.

Two files that serve the same URLs stop the app with an error naming both: a `page.tsx` and a `route.ts` in one folder, two route groups with the same folders below them, or `:id` and `:slug` in the same place.

## Pages

```tsx
// src/app/posts/:id/page.tsx
import { notFound, type PageProps } from '@reeywhaar/bananacms'
import { findPost } from '../../../lib/posts.ts'

export default async function PostPage(props: PageProps<{ id: string }>) {
  const { id } = await props.params
  const post = await findPost(props.ctx, id)
  if (!post) notFound()

  return (
    <article>
      <h1>{post.title}</h1>
    </article>
  )
}
```

- A page is a server component, and it can be async.
- It gets `ctx`, the request's context with its cookies, logger, databases and signed-in user ([context.md](context.md)).
- It also gets `params` and `searchParams`, both as promises, as in Next.js 15+. A `searchParams` value is a string, or an array when the key repeats (`?tag=a&tag=b`).
- Its title and other `<head>` tags come from its [metadata](#metadata).

## Layouts

```tsx
// src/app/layout.tsx
import type { LayoutProps } from '@reeywhaar/bananacms'

export default function RootLayout(props: LayoutProps) {
  return (
    <html lang="en">
      <body>{props.children}</body>
    </html>
  )
}
```

- Layouts nest from `src/app/` down to the page's folder, including `(group)` folders. Each gets `ctx`, `params` and `children`.
- A page's outermost layout is its root layout, which renders `<html>` and `<body>`. The CMS adds the charset and viewport tags and the redirect for browsers with JavaScript off.
- A site can have several root layouts, as in Next.js: with no `src/app/layout.tsx`, each `(group)` or folder can have its own. Navigating to a page with another root layout loads it in full, since that layout brings its own styles.
- On navigation, the layouts both pages share stay mounted, so their client state survives. The page itself mounts fresh for every URL, so its Suspense fallbacks show right away.
- A page with no layout above it gets a plain `<html><body>` one.

## Not found

A page that calls `notFound()` gets the not-found page closest to it: the `not-found.tsx` in its folder, or in the nearest folder above.

- **Where it renders:** for a `notFound()` from `generateMetadata()`, which runs before rendering, inside the layouts from `src/app/` down to the not-found page's folder, as in Next.js. For one from the page's own body, in the page's place, inside all of the page's layouts, which have rendered by then.
- **Its title** goes through the template of the layout in its own folder too, as in Next.js: a `(main)/not-found.tsx` with `title: '404'` under a `(main)/layout.tsx` with the template `'%s | Site'` is "404 | Site".
- **A URL with no route** gets `src/app/global-not-found.tsx`, if the site has one: the whole document, with no layout around it, so it renders `<html>` and `<body>` itself. It gets `ctx` as a prop, and its metadata is its own. Otherwise the URL gets `src/app/not-found.tsx`, inside the root layout.
- **The status:** the response is a 404 whenever `notFound()` comes from `generateMetadata()`, which runs before rendering. From the page's own body, the HTML response is a 404 when it runs outside a Suspense boundary; the response headers go out once that part of the page has rendered. On client-side navigation the not-found page renders in place, and the response status plays no part.
- A site with no not-found page for a URL gets a plain "404: This page could not be found." page.

## Errors

A folder's `error.tsx` catches what throws below its layout, as in Next.js: the folder's page, and the layouts and pages in the folders below. It's a client component, so the file starts with `'use client'`:

```tsx
// src/app/error.tsx
'use client'

import type { ErrorPageProps } from '@reeywhaar/bananacms/client'

export default function ErrorPage({ unstable_retry }: ErrorPageProps) {
  return (
    <main>
      <h1>Something went wrong</h1>
      <button onClick={unstable_retry}>Try again</button>
    </main>
  )
}
```

- **Where it shows:** in place of what threw, inside the layouts above it. An error in a folder's own layout goes to the `error.tsx` of a folder above.
- **`global-error.tsx`:** for an error in the root layout, or with no `error.tsx` above it. It renders `<html>` and `<body>` itself, since it takes the whole document's place. A site without one gets a plain page, and so does `/manage`.
- **Props:** `error`; `reset()`, which renders what threw again; and `unstable_retry()`, which fetches the page from the server again first. Navigating to another path clears the error as well.
- **`generateMetadata()`:** an error it throws goes to the page's `error.tsx`, like one from the page itself.
- **The first load:** React renders error pages in the browser, as in Next.js. A page that throws outside a Suspense boundary gets a 500, with an empty document and the page's data, and the browser renders the page with its error page in it. With JavaScript off, it stays empty. An error inside a Suspense boundary keeps the rest of the page, and its status.
- **The error:** in development, an error from a server component keeps its message. In production the message is a generic one, and `error.digest` is the request's trace id, which finds the error in the log: every error thrown while rendering is logged once, as `[Request] [Render] failed`.
- `notFound()` and `redirect()` throw too, but they're not errors: they get the not-found page and the redirect, as above.

## Metadata

A page's title, description, Open Graph tags and icons come from its metadata. Pages, layouts and `not-found.tsx` declare it as in Next.js: with a `metadata` export, or a `generateMetadata()` that returns it.

```tsx
// src/app/layout.tsx
import type { Metadata } from '@reeywhaar/bananacms'

export const metadata: Metadata = {
  metadataBase: new URL('https://example.com'),
  title: { template: '%s | Example', default: 'Example' },
  description: 'Notes on everything',
  openGraph: { images: '/og.png' },
}
```

```tsx
// src/app/posts/:id/page.tsx
export async function generateMetadata({
  ctx,
  params,
}: PageProps<{ id: string }>): Promise<Metadata> {
  const post = await findPost(ctx, (await params).id)
  if (!post) notFound()
  return { title: post.title }
}
```

- **Merging:** the metadata of the layouts, from `src/app/` down, and then the page's, merge key by key. A later `openGraph` replaces an earlier one whole. A key set to `null` removes it, and one set to `undefined` keeps the value from above.
- **Titles:** a layout's `title.template` wraps the titles of the layouts and pages in the folders below its own, so a post titled "Hello" gets "Hello | Example". A page in the layout's own folder, like `src/app/page.tsx` here, keeps its title as it is, as in Next.js. `title.default` is the title for the pages below that set none, and `{ absolute }` is a title no template wraps. A nested layout's template replaces the one above it.
- **`generateMetadata(props, parent)`:** a page's gets `ctx`, `params` and `searchParams`; a layout's or not-found page's gets `ctx` and `params`. `parent` is a promise of the metadata above it. The `generateMetadata()` calls of a page and its layouts all start at once.
- **Before rendering:** metadata resolves before the page renders, so a `notFound()` or `redirect()` from `generateMetadata()` makes the whole response a 404 or a redirect, on client-side navigation too. It also runs outside React's render, so a loader wrapped in React's `cache()` and called from both `generateMetadata()` and the page runs twice.
- **Not found:** the not-found page renders with its own metadata under the layouts', in place of the page's.
- **Fields:** `title`, `description`, `keywords`, `authors`, `robots`, `alternates` (`canonical`, `languages`, `types`), `openGraph` (`title`, `description`, `url`, `siteName`, `locale`, `type`, `images`) and `icons` (`icon`, `shortcut`, `apple`). `metadataBase` makes the relative URLs in `openGraph` and `alternates` absolute.
- **Tags:** they come out as Next.js renders them, down to the order, with Twitter card tags that repeat the Open Graph ones. React hoists them into `<head>`.

## Route handlers

A `route.ts` answers its folder's URL with a function per HTTP method, named after it. Each gets the request's `ctx` and returns a `Response`:

```ts
// src/app/api/posts/:id/route.ts
import { getDb, getParams, getRequest, notFound, type Context } from '@reeywhaar/bananacms'
import { PostStore } from '@reeywhaar/bananacms/stores'

export async function GET(ctx: Context) {
  const { id } = getParams<{ id: string }>(ctx)
  const post = await new PostStore(getDb(ctx)).query().byShortId(id).first()
  if (!post) notFound()
  return Response.json(post)
}

export async function POST(ctx: Context) {
  const body = await getRequest(ctx).json()
  // …
  return new Response(null, { status: 204 })
}
```

- The functions are `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE` and `OPTIONS`. The middleware runs first, as for pages, and no layouts wrap the response.
- As in Next.js, a `HEAD` request without its own function gets `GET`'s response without the body, and an `OPTIONS` request without one gets a 204 with an `Allow` header listing the methods. Any other method is a 405.
- `notFound()` answers with an empty 404, and `redirect()` with a redirect.
- A link to a route handler's URL loads it as a document: on client-side navigation, the server tells the browser the URL isn't a page.

## Sitemaps

A `sitemap.ts` serves `sitemap.xml` in its folder, as in Next.js: `src/app/sitemap.ts` is `/sitemap.xml`. Its default export gets `ctx`, and returns the entries:

```ts
// src/app/sitemap.ts
import { getDb, type Context, type Sitemap } from '@reeywhaar/bananacms'
import { PostStore } from '@reeywhaar/bananacms/stores'

export default async function sitemap(ctx: Context): Promise<Sitemap> {
  const posts = await new PostStore(getDb(ctx)).query().published().all()
  return posts.map((post) => ({
    url: `https://example.com/posts/${post.shortid}`,
    lastModified: new Date(post.updatedAt ?? post.createdAt),
  }))
}
```

An entry has a `url`, and can have `lastModified`, `changeFrequency`, `priority`, `alternates.languages` and `images`. The XML comes out as Next.js writes it, with the URLs escaped.

## Navigation

- Plain `<a href>` links within the site navigate client-side: the browser fetches the new page's RSC payload and React swaps the page in. Calling `history.pushState()` or `replaceState()` navigates the same way.
- The browser handles new-tab clicks (modifier keys, middle click), links with a `download` attribute or a `target` other than `_self`, and links to other origins on its own.
- Links between the site and `/manage` do a full page load, because they're separate apps with separate styles. So do links to uploaded files, under `/d/`, which aren't pages.
- A page with a new path starts at its top, or at the element its URL's hash names, and back and forward bring a page back scrolled as it was left. A refresh, or a server action's re-render, leaves the scroll as it is.
- `<Link href>` from `@reeywhaar/bananacms/client` is such a link, and works in server components too.
- In client components, `useRouter()` from `@reeywhaar/bananacms/client` navigates: `push(href)`, `replace(href)`, `refresh()`, which renders the current URL again with fresh data, and `back()`. `usePathname()` and `useSearchParams()` return the current URL's parts, and `useNavigationPending()` is true while a navigation or a server action's re-render is in flight.
- With JavaScript off, site pages redirect to `?__nojs`, which sends each page complete in one response.

## Redirects

`redirect(url)` from `@reeywhaar/bananacms` sends the browser elsewhere, with a 307; `permanentRedirect(url)` does it with a 308. It works in:

- **middleware**, as a response in place of the page;
- **a page's own body**: before the response headers go out, the response is the redirect; after, on client-side navigation or from inside a Suspense boundary, the page renders a client-side redirect in its place;
- **a server action**: the browser goes to `url` instead of re-rendering the page;
- **`generateMetadata()`**, before the page renders, so the response is the redirect on every request.

The redirect for a form posted without JavaScript is a 303, which the browser follows with a GET.

A client-side navigation that ends in a redirect goes on to the target without a full page load, and the address bar shows the target.

## Reserved URLs

- `/manage` and everything below it belong to the CMS admin.
- `/d/…` serves uploaded files and image variants.
- A `_.rsc` suffix (`/posts_.rsc`) returns a page's RSC payload. The browser uses it for client-side navigation.
- `?__nojs` renders a page complete, with no scripts.

## Migrating from Next.js

| Next.js                                                                               | bananacms                                                                                                                                                                            |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `[id]`                                                                                | `:id`                                                                                                                                                                                |
| `[...slug]`                                                                           | `:slug+`                                                                                                                                                                             |
| `[[...slug]]`                                                                         | `:slug*`                                                                                                                                                                             |
| `import { notFound } from 'next/navigation'`                                          | `import { notFound } from '@reeywhaar/bananacms'`                                                                                                                                    |
| `import { usePathname } from 'next/navigation'`                                       | `import { usePathname } from '@reeywhaar/bananacms/client'`                                                                                                                          |
| `useRouter()`, `useSearchParams()` from `next/navigation`                             | the same from `@reeywhaar/bananacms/client`                                                                                                                                          |
| `redirect()` from `next/navigation`                                                   | `redirect()` from `@reeywhaar/bananacms`                                                                                                                                             |
| `import Link from 'next/link'`                                                        | `import { Link } from '@reeywhaar/bananacms/client'`                                                                                                                                 |
| `cookies()` and `headers()` from `next/headers`                                       | `getCookies(ctx)` and `getRequest(ctx).headers`                                                                                                                                      |
| `route.ts`: `GET(request, { params })`                                                | `GET(ctx)`, with `getRequest(ctx)` and `getParams(ctx)` ([Route handlers](#route-handlers))                                                                                          |
| `sitemap.ts` returning `MetadataRoute.Sitemap`                                        | the same, returning `Sitemap` from `@reeywhaar/bananacms`, with `ctx` as its argument                                                                                                |
| `paths` in `tsconfig.json`, like `@/*`                                                | the same: the CMS reads them, for code and for CSS                                                                                                                                   |
| `next/font/google`                                                                    | a Fontsource package, self-hosted as well: its CSS imported, like `@fontsource-variable/noto-sans-display/wdth.css`, and its family named in CSS where `className` or `variable` was |
| CSS modules, and Sass with `sass` installed                                           | the same                                                                                                                                                                             |
| `middleware.ts`                                                                       | `src/middleware.ts`, Koa-style ([context.md](context.md#middleware))                                                                                                                 |
| `not-found.tsx` in any folder, `global-not-found.tsx` (`experimental.globalNotFound`) | the same, with `ctx` as `global-not-found.tsx`'s prop ([Not found](#not-found))                                                                                                      |
| `error.tsx`, `global-error.tsx`                                                       | the same, with `ErrorPageProps` from `@reeywhaar/bananacms/client` for their props ([Errors](#errors))                                                                               |
| a `'use server'` function                                                             | the same, or `defineAction()` to get `ctx`                                                                                                                                           |
| `metadata` / `generateMetadata` exports, `Metadata` from `next`                       | the same, with `Metadata` from `@reeywhaar/bananacms` ([Metadata](#metadata))                                                                                                        |

`params` and `searchParams` have the same shapes as in Next.js 15+.

Still to come: `loading.tsx`, `robots.ts`, `generateStaticParams`, and parallel and intercepting routes.

## Where it lives

- [`cms/src/framework/route-table.ts`](../cms/src/framework/route-table.ts): folder names to URL patterns, matching and precedence.
- [`cms/src/framework/routes.ts`](../cms/src/framework/routes.ts): finds the site's files with `import.meta.glob`.
- [`cms/src/framework/app.tsx`](../cms/src/framework/app.tsx): renders a matched page inside its layouts, and handles not-found.
