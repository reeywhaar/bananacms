import { getRequest, type Context } from './context.ts'
import { isNotFoundError } from './not-found.ts'
import type { SitemapModule } from './routes.ts'
import { sitemapXml } from './sitemap.ts'

// A route.ts exports a function per HTTP method it answers, `GET(ctx)` and so on,
// each returning the Response (docs/routing.md#route-handlers).
export type RouteHandler = (ctx: Context) => Response | Promise<Response>

const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const
type Method = (typeof METHODS)[number]

export type RouteHandlers = Partial<Record<Method, RouteHandler>>

// Calls the handler for the request's method. As in Next, a HEAD request without
// one gets GET's response without its body, and an OPTIONS request the methods
// there are. Any other method is a 405, and a notFound() from a handler an empty
// 404.
export async function answer(
  ctx: Context,
  handlers: RouteHandlers,
  file: string,
): Promise<Response> {
  try {
    return await dispatch(ctx, handlers, file)
  } catch (error) {
    if (isNotFoundError(error)) return new Response(null, { status: 404 })
    throw error
  }
}

async function dispatch(ctx: Context, handlers: RouteHandlers, file: string): Promise<Response> {
  const method = getRequest(ctx).method
  const handler = isMethod(method) ? handlers[method] : undefined
  if (handler) return checkResponse(await handler(ctx), method, file)
  if (method === 'HEAD' && handlers.GET) {
    const response = checkResponse(await handlers.GET(ctx), 'GET', file)
    void response.body?.cancel()
    return new Response(null, response)
  }
  const allow = allowedMethods(handlers).join(', ')
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow } })
  return new Response(null, { status: 405, headers: { allow } })
}

// A sitemap.ts as a route with one handler, with the headers Next sends it with
export function sitemapHandlers(module: SitemapModule): RouteHandlers {
  return {
    GET: async (ctx) =>
      new Response(sitemapXml(await module.default(ctx)), {
        headers: {
          'content-type': 'application/xml',
          'cache-control': 'public, max-age=0, must-revalidate',
        },
      }),
  }
}

function isMethod(method: string): method is Method {
  return (METHODS as readonly string[]).includes(method)
}

function allowedMethods(handlers: RouteHandlers): Method[] {
  const allowed = new Set<Method>(['OPTIONS'])
  for (const method of METHODS) if (handlers[method]) allowed.add(method)
  if (allowed.has('GET')) allowed.add('HEAD')
  return METHODS.filter((method) => allowed.has(method))
}

function checkResponse(response: unknown, method: string, file: string): Response {
  if (response instanceof Response) return response
  throw new TypeError(
    `${method} in ${file} returned ${response === undefined ? 'nothing' : typeof response}, not a Response`,
  )
}
