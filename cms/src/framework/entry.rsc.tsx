import {
  renderToReadableStream,
  createTemporaryReferenceSet,
  decodeReply,
  loadServerAction,
  decodeAction,
  decodeFormState,
} from '@vitejs/plugin-rsc/rsc/server'
import type { ReactNode } from 'react'
import type { ReactFormState } from 'react-dom/client'
import { errorFields } from '../lib/logger/Logger.ts'
import { createRootLogger } from '../lib/logger/root.ts'
import { invokeAction } from './actions.ts'
import { renderApp } from './app.tsx'
import { cmsMiddleware, since } from './cms-middleware.ts'
import {
  Context,
  createRequestContext,
  getCookies,
  getLogger,
  getRequest,
  getResponseRedirect,
  getResponseStatus,
  getUrl,
  isRscRequest,
  setDatabases,
  setLogger,
} from './context.ts'
import {
  createDatabasesOpener,
  requestDatabases,
  setDatabasesOpener,
  type DatabasesOpener,
} from './databases.ts'
import { runMiddleware, type Middleware } from './middleware.ts'
import { isNotFoundError } from './not-found.ts'
import { documentResponse, redirectResponse } from './redirect-response.ts'
import { redirectTarget } from './redirect.ts'
import { answer, sitemapHandlers } from './route-handlers.ts'
import type { Route } from './route-table.ts'
import { isManagePath, isNojs, parseRenderRequest, type RenderRequest } from './request.ts'
import { loadRouteHandlers, loadSitemap, matchRoute, type RouteMatch } from './routes.ts'

// The schema of payload which is serialized into RSC stream on rsc environment
// and deserialized on ssr/client environments.
export type RscPayload = {
  // the entire <html> document, re-rendered on every navigation
  root: ReactNode
  // what usePathname() and useSearchParams() return while rendering it
  pathname: string
  search: string
  // The root layout that renders `root`'s <html> (app.tsx). The browser loads a
  // page with another one as a document, as Next does, since it brings its own
  // styles.
  rootLayout?: string
  // where the browser goes instead of rendering `root`: set by a redirect() from
  // middleware or a server action (redirect-response.ts)
  redirect?: string
  // the URL isn't a page but a route.ts's or a sitemap.ts's, which the browser
  // loads as a document instead
  document?: boolean
  // server action return value of non-progressive enhancement case
  returnValue?: { ok: boolean; data: unknown }
  // server action form state (e.g. useActionState) of progressive enhancement case
  formState?: ReactFormState
}

// The plugin assumes by default that the `rsc` entry has a default export of a request handler.
// close() is for the CLI's shutdown, once the server has stopped taking requests:
// it closes the site's databases.
export default { fetch: handleRequest, close: () => databases.close() }

// What lasts as long as the server: its logger, which has no label, and the
// databases (databases.ts). Every request's context is a child of it. The dev
// server keeps the open databases across reloads of this module, and makes the
// context itself anew, since a reloaded context.ts has new keys for its values.
const databases: DatabasesOpener = import.meta.hot?.data.databases ?? createDatabasesOpener()
if (import.meta.hot) import.meta.hot.data.databases = databases
const appContext = setDatabasesOpener(setLogger(new Context(), createRootLogger()), databases)

// the site's middleware: the default export of src/middleware.ts, if it has one
const siteMiddleware: readonly Middleware[] =
  Object.values(
    import.meta.glob<{ default: readonly Middleware[] }>('/src/middleware.ts', { eager: true }),
  )[0]?.default ?? []

// Builds the request's ctx, and runs the CMS's middleware, then the site's, then
// a route.ts or sitemap.ts (route-handlers.ts), or the page or action (handler
// below).
async function handleRequest(request: Request): Promise<Response> {
  let renderRequest: RenderRequest
  try {
    renderRequest = parseRenderRequest(request)
  } catch (error) {
    getLogger(appContext).child('Request').warn('rejected', errorFields(error))
    return new Response('Bad Request', { status: 400 })
  }

  const { url } = renderRequest
  const match = isManagePath(url.pathname) ? undefined : matchRoute(url.pathname)
  const ctx = createRequestContext(appContext, {
    request: renderRequest.request,
    url,
    params: match?.params ?? {},
    logger: getLogger(appContext).child('Request', {
      traceId: request.headers.get('x-trace-id') ?? crypto.randomUUID(),
      request: { method: request.method, path: url.pathname },
    }),
    rsc: renderRequest.isRsc,
  })
  const response = await runMiddleware(ctx, [...cmsMiddleware, ...siteMiddleware], () =>
    match && match.route.kind !== 'page'
      ? serveRoute(ctx, match.route)
      : handler(ctx, renderRequest, match),
  )
  return withCookies(response, getCookies(ctx).setCookieHeaders)
}

async function handler(
  ctx: Context,
  renderRequest: RenderRequest,
  match: RouteMatch | undefined,
): Promise<Response> {
  const request = renderRequest.request

  // handle server function request
  let returnValue: RscPayload['returnValue'] | undefined
  let formState: ReactFormState | undefined
  let temporaryReferences: unknown | undefined
  let actionStatus: number | undefined
  if (renderRequest.isAction === true) {
    if (renderRequest.actionId) {
      // action is called via `ReactClient.setServerCallback`.
      const actionId = renderRequest.actionId
      const contentType = request.headers.get('content-type')
      const body = contentType?.startsWith('multipart/form-data')
        ? await request.formData()
        : await request.text()
      temporaryReferences = createTemporaryReferenceSet()
      const args = await decodeReply(body, { temporaryReferences })
      const action = await loadServerAction(actionId)
      try {
        const data = await runAction(ctx, actionId, (actionCtx) =>
          invokeAction(action, args as unknown[], actionCtx),
        )
        returnValue = { ok: true, data }
      } catch (e) {
        // a redirect() tells the browser where to go instead of re-rendering this page
        const target = redirectTarget(e)
        if (target) return redirectResponse(ctx, target, true)
        returnValue = { ok: false, data: e }
        actionStatus = 500
      }
    } else {
      // a server function called via `<form action={...}>` before hydration
      // (e.g. with JavaScript off), aka progressive enhancement.
      const formData = await request.formData()
      const decodedAction = await decodeAction(formData)
      try {
        const result = await runAction(ctx, formActionId(formData), (actionCtx) =>
          invokeAction(decodedAction, [], actionCtx),
        )
        formState = await decodeFormState(result, formData)
      } catch (e) {
        // a redirect() after a form post is a 303, which the browser follows with a GET
        const target = redirectTarget(e)
        if (target) return redirectResponse(ctx, target, false)
        // surface a failed form action as a classic 500 response
        return new Response('Internal Server Error: server action failed', {
          status: 500,
        })
      }
    }
  }

  // serialization from React VDOM tree to RSC stream.
  // we render RSC stream after handling server function request
  // so that new render reflects updated state from server function call
  // to achieve single round trip to mutate and fetch from server.
  const { root, status, rootLayout } = await renderApp(ctx, match)
  const rscPayload: RscPayload = {
    root,
    pathname: getUrl(ctx).pathname,
    search: getUrl(ctx).search,
    rootLayout,
    formState,
    returnValue,
  }
  const rscStream = renderToReadableStream<RscPayload>(rscPayload, {
    temporaryReferences,
    onError: (error: unknown) => logRenderError(ctx, 'rsc', error),
  })

  // Respond with the bare RSC stream, as decided by `RenderRequest`
  if (renderRequest.isRsc) {
    return new Response(rscStream, {
      status: actionStatus ?? status,
      headers: {
        'content-type': 'text/x-component;charset=utf-8',
      },
    })
  }

  // Delegate to SSR environment for html rendering.
  // The plugin provides `loadModule` helper to allow loading SSR environment entry module
  // in RSC environment.
  const ssrEntryModule = await import.meta.viteRsc.loadModule<typeof import('./entry.ssr.tsx')>(
    'ssr',
    'index',
  )
  const ssrResult = await ssrEntryModule.renderHTML(rscStream, {
    formState,
    // render for a browser with JavaScript off. app.tsx sends such browsers
    // here, and it's also handy for simulating one in a normal browser.
    nojs: isNojs(getUrl(ctx)),
    onError: (error: unknown) => {
      // an error from the RSC payload was logged as the server rendered it
      if (!fromRscPayload(error)) logRenderError(ctx, 'ssr', error)
    },
  })

  // a redirect() from the page's own body, before the headers went out
  const redirect = getResponseRedirect(ctx)
  if (redirect) {
    void ssrResult.stream.cancel()
    return new Response(null, { status: redirect.status, headers: { location: redirect.url } })
  }

  // respond html
  return new Response(ssrResult.stream, {
    // the shell has rendered by now, so a notFound() from the page has set its 404
    status: ssrResult.status ?? getResponseStatus(ctx) ?? status,
    headers: {
      'Content-type': 'text/html',
    },
  })
}

// Serves a route.ts, or a sitemap.ts as its sitemap.xml (route-handlers.ts). A
// client-side navigation to one gets a payload that has the browser load the URL
// as a document.
async function serveRoute(ctx: Context, route: Route): Promise<Response> {
  if (isRscRequest(ctx)) return documentResponse(ctx)
  const handlers =
    route.kind === 'sitemap'
      ? sitemapHandlers(await loadSitemap(route))
      : await loadRouteHandlers(route)
  return answer(ctx, handlers, route.file)
}

// Runs a server action with a ctx of its own, whose logger is labeled
// [Request] [Action], its queries included, and logs how it went.
async function runAction<T>(
  ctx: Context,
  actionId: string | undefined,
  run: (actionCtx: Context) => Promise<T>,
): Promise<T> {
  // Ids end in the action's name, "<module>#login"; an action written inline in a
  // component is hoisted under a prefixed one, "<module>#$$hoist_0_vote".
  const name = actionId
    ?.split('#')
    .at(-1)
    ?.replace(/^\$\$hoist_\d+_/, '')
  const log = getLogger(ctx).child('Action', { action: name ?? 'unknown' })
  const startedAt = performance.now()
  log.debug('start', { actionId })
  try {
    const actionCtx = setLogger(ctx.child(), log)
    setDatabases(actionCtx, await requestDatabases(actionCtx))
    const result = await run(actionCtx)
    log.info('end', { durationMs: since(startedAt) })
    return result
  } catch (error) {
    const target = redirectTarget(error)
    if (target) log.info('end', { durationMs: since(startedAt), redirect: target.url })
    else log.error('failed', { durationMs: since(startedAt), ...errorFields(error) })
    throw error
  }
}

// The action a no-JS form posts to, from React's hidden fields: $ACTION_ID_<id>,
// or $ACTION_REF_<n> with the id in $ACTION_<n>:0 when the action has state or
// bound arguments.
function formActionId(formData: FormData): string | undefined {
  for (const key of formData.keys()) {
    if (key.startsWith('$ACTION_ID_')) return key.slice('$ACTION_ID_'.length)
    if (key.startsWith('$ACTION_REF_')) {
      try {
        const meta = formData.get(`$ACTION_${key.slice('$ACTION_REF_'.length)}:0`)
        return (JSON.parse(String(meta)) as { id?: string }).id
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

// Errors thrown while rendering. notFound() throws too, to ask for the 404 page,
// and that's left out.
//
// Returns the error's digest: the request's trace id, which React sends the
// browser with the error, in place of its message in production. An error page
// can show it, and it finds the error's line in the log.
function logRenderError(ctx: Context, stage: 'rsc' | 'ssr', error: unknown): string | undefined {
  if (isNotFoundError(error)) return undefined
  const log = getLogger(ctx).child('Render', { stage })
  // the browser went away mid-render, or its next navigation replaced this one
  if (getRequest(ctx).signal.aborted || isAbortedRender(error)) log.debug('aborted')
  else log.error('failed', errorFields(error))
  const { traceId } = log.fields
  return typeof traceId === 'string' ? traceId : undefined
}

// React's error for a render whose stream was cancelled
function isAbortedRender(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      error.message === 'The render was aborted by the server without a reason.')
  )
}

// React revives an error from the RSC payload with the environment it was thrown
// in (development) or its digest (production).
function fromRscPayload(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && ('environmentName' in error || 'digest' in error)
  )
}

// The response with the cookies set while handling the request. It's a new
// Response, since one made by Response.redirect() has read-only headers.
function withCookies(response: Response, setCookieHeaders: readonly string[]): Response {
  if (setCookieHeaders.length === 0) return response
  const withHeaders = new Response(response.body, response)
  for (const header of setCookieHeaders) withHeaders.headers.append('set-cookie', header)
  return withHeaders
}

if (import.meta.hot) {
  import.meta.hot.accept()
}
