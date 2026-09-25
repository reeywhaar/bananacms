# Context

Code that serves a request gets a context, `ctx`, as its first argument or prop. It's a bag of values by key: the request, its cookies, a logger, the databases and the signed-in user. Code passes it on to its helpers and child components as an argument. Nothing hands it out any other way.

## Scopes

A context can have a parent, and reads what it doesn't hold itself from there. `ctx.child()` makes a narrower scope that sets only what it changes:

```ts
const actionCtx = setLogger(ctx.child(), getLogger(ctx).child('Action'))
```

- The **app context** holds what lasts as long as the server runs: its logger, which has no label, and the databases.
- Each **request's context** is a child of it. The CMS starts it with the request, and its middleware adds the databases and the session. Then the site's middleware can add values of its own.
- A **server action** gets a child of the request's, whose logger is labeled `[Request] [Action]`.

## Values

The CMS's values come through functions, one per value:

| Function                          |                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `getRequest(ctx)`                 | the `Request`                                                                                       |
| `getUrl(ctx)`                     | the page's URL; for a client-side navigation request, without its `_.rsc` suffix                    |
| `getParams(ctx)`                  | the matched route's params, as a plain object; `getParams<{ id: string }>(ctx)` names their shape   |
| `getCookies(ctx)`                 | `get(name)`, `set(name, value, { maxAge })` and `delete(name)`                                      |
| `getLogger(ctx)`                  | the scope's logger: `[Request]` for a request (see [Logging](#logging))                             |
| `setLogger(ctx, logger)`          | gives the scope a logger of its own                                                                 |
| `getDb(ctx)`, `getDerivedDb(ctx)` | drizzle handles for `database.db` and `derived.db`, for the stores in `@reeywhaar/bananacms/stores` |
| `getAuth(ctx)`                    | the signed-in CMS user, `{ user: { id, name }, token, tokenExpiresAt }`, or `undefined`             |

A getter for a value the context lacks throws, naming it: `getDb()` in code that runs before the CMS's middleware fails with "The context has no Db".

A cookie set in middleware or in a server action goes out with the response. Pages render while the response streams, often after its headers have gone out, so a page reads cookies and leaves setting them to middleware and actions.

### A site's own values

A site keeps its values under symbols of its own, behind functions like the CMS's. `required()` does the throwing for a missing one:

```ts
// src/lib/locale.ts
import { required, type Context } from '@reeywhaar/bananacms'

const LOCALE = Symbol('Locale')

export const getLocale = (ctx: Context): string => required(ctx, LOCALE)

export const setLocale = (ctx: Context, locale: string): Context => ctx.set(LOCALE, locale)
```

Symbols keep two values filed under the same word apart, and the functions keep the symbol in one module. The demo sets its locale this way in `src/middleware.ts`, and its home page reads it.

## Pages and layouts

Both get `ctx` as a prop, next to `params`:

```tsx
// src/app/posts/:id/page.tsx
import { getDb, notFound, type PageProps } from '@reeywhaar/bananacms'
import { PostStore } from '@reeywhaar/bananacms/stores'
import { PostBody } from '../../../components/PostBody.tsx'

export default async function PostPage({ ctx, params }: PageProps<{ id: string }>) {
  const { id } = await params
  const post = await new PostStore(getDb(ctx)).query().published().byShortId(id).first()
  if (!post) notFound()

  return (
    <article>
      <title>{post.name}</title>
      <h1>{post.name}</h1>
      <PostBody ctx={ctx} post={post} />
    </article>
  )
}
```

`ctx` reaches server code only. A client component can't receive it, because it isn't serializable.

## Server actions

`defineAction` gives an action its `ctx` before its own arguments. Callers pass only their arguments: `rename(formData)`, or `<form action={rename}>`.

```ts
'use server'

import { defineAction, getAuth } from '@reeywhaar/bananacms'

export const rename = defineAction(async (ctx, formData: FormData) => {
  if (!getAuth(ctx)) throw new Error('Not signed in')
  // …
})
```

- The CMS runs every action with its `ctx` as an extra last argument, after the browser's, and `defineAction` moves it to the front. A form posted without JavaScript reaches the action through React already bound to its arguments, and the `ctx` lands after those all the same. What the browser sends is plain data, so it can't pass a `Context` itself.
- A server action can be called from any page, so one that needs a signed-in user checks `getAuth(ctx)` itself.

## Middleware

Middleware is Koa-style: `(ctx, next) => Promise<Response>`. `next()` runs the rest of the chain and returns its `Response`. A middleware can change that response, for example by adding a header, or return a response of its own without calling `next()`. `redirect()` works in middleware too.

It runs in this order:

1. The CMS's middleware: the request log, the databases (`getDb()`), asset delivery at `/d/…`, then the session (`getAuth()`), and the `/manage` login gate.
2. The site's middleware: the default export of `src/middleware.ts`, if it has one.
3. The page, or the server action followed by the page it re-renders.

```ts
// src/middleware.ts
import { getRequest, type Middleware } from '@reeywhaar/bananacms'
import { setLocale } from './lib/locale.ts'

export default [
  async (ctx, next) => {
    setLocale(ctx, pickLocale(getRequest(ctx).headers.get('accept-language')))
    return next()
  },
] satisfies Middleware[]
```

## Logging

A request's logger is labeled `[Request]`. `child(label, fields)` makes a logger for part of the work, and its label goes after its parent's: `getLogger(ctx).child('Auth')` logs as `[Request] [Auth]`, and a child of that adds a third bracket.

- **Fields:** a logger's fields go on every line it logs, and a call can add its own: `log.info('login.success', { userId })`. A child's field wins over its parent's on the same key, and nested objects merge key by key, so a parent's `request: { host }` and a child's `request: { path }` give both. `logger.set(fields)` adds fields later, and they show up in the children's lines too.
- **Levels:** `debug`, `info`, `warn` and `error`. `LOG_LEVEL` sets the lowest one written, `info` by default.
- **Formats:** `LOG_FORMAT=dev` writes one line per entry, which is the default outside production:

  ```
  [09:25:17.972] [INF] [d4da5464] [Request] [Action] [Auth] login.attempt username=alice request={"method":"POST","path":"/manage/login"} auth={"type":"guest"}
  ```

  `LOG_FORMAT=json` writes one JSON object per entry, with the labels as an array, `"labels":["Request","Auth"]`. It's the default in production.

Every line in a request carries the request's `traceId`, which comes from an `x-trace-id` header or is a new UUID. Each line also carries `request: { method, path }` and `auth: { type }`, where the type is `user`, `guest` or `invalidToken`.

The CMS logs this:

| Label                | Messages                                                                   |                                                                          |
| -------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `[Request]`          | `start` (debug), `end` (info), `failed` (error)                            | each request, with its status and `durationMs`; `failed` becomes a 500   |
| `[Request] [Action]` | `start` (debug), `end` (info), `failed` (error)                            | each server action, with its name and duration                           |
| `[Request] [Render]` | `failed` (error), `aborted` (debug)                                        | each error thrown while rendering, once; `aborted` when the browser left |
| `[Request] [DB]`     | `query` (debug), `query.slow` (warn, 100 ms and up), `query.failed` (warn) | each query's SQL and timing; its parameters aren't logged                |
| `[Request] [Auth]`   | `login.attempt`, `login.success`, `login.failure`, `logout`                | sessions                                                                 |

A query's line has its scope's labels: an action's queries log as `[Request] [Action] [DB]`.

## React's development build copies props

In development, React copies every server component's props into the data it sends the page, for React DevTools. Production builds leave that data out.

- A context keeps its values in private fields, which React doesn't read, so its copy is empty, a site's values included.
- Any other props a server component gets are visible in the page's data when it's served by `bananacms dev`. Keep secrets out of server component props, and don't serve `dev --host` on a network you don't trust.
- React has no option that turns this off. Its `debugChannel` moves the data to a second stream, and the browser's React waits for that stream before it hydrates.

## Where it lives

- [`cms/src/framework/context.ts`](../cms/src/framework/context.ts): `Context`, `required()`, and the CMS's values.
- [`cms/src/framework/entry.rsc.tsx`](../cms/src/framework/entry.rsc.tsx): the app context, each request's context, the middleware chain, and the actions' scopes.
- [`cms/src/framework/middleware.ts`](../cms/src/framework/middleware.ts) and [`cms-middleware.ts`](../cms/src/framework/cms-middleware.ts): the `Middleware` type, and the CMS's own.
- [`cms/src/framework/actions.ts`](../cms/src/framework/actions.ts): `defineAction()`.
- [`cms/src/framework/databases.ts`](../cms/src/framework/databases.ts): the databases, opened once, and each request's handles on them.
- [`cms/src/framework/cookies.ts`](../cms/src/framework/cookies.ts): `Cookies`.
- [`cms/src/lib/auth.ts`](../cms/src/lib/auth.ts): sessions, in the `auth` cookie and the `authtoken` table, and the `/manage` gate.
- [`cms/src/lib/logger/`](../cms/src/lib/logger/): the logger and its formats; [`cms/src/lib/db/queryLog.ts`](../cms/src/lib/db/queryLog.ts): query logging.
