import { renderToReadableStream } from '@vitejs/plugin-rsc/rsc/server'
import type { Context } from './context.ts'
import type { RscPayload } from './entry.rsc.tsx'
import type { RedirectTarget } from './redirect.ts'
import { getRequest, getUrl } from './context.ts'

// The response for a redirect(): a redirect status for a document request, and for
// an RSC request (client-side navigation, a server action) a payload naming the
// target, which the browser then navigates to.
export function redirectResponse(ctx: Context, target: RedirectTarget, rsc: boolean): Response {
  if (!rsc) {
    // after a form post, a 303, which the browser follows with a GET, where a 307
    // or 308 would post the form again
    const status = getRequest(ctx).method === 'POST' ? 303 : target.status
    return new Response(null, { status, headers: { location: target.url } })
  }
  const payload: RscPayload = {
    root: null,
    pathname: getUrl(ctx).pathname,
    search: getUrl(ctx).search,
    redirect: target.url,
  }
  return payloadResponse(payload)
}

// The response to a client-side navigation to a URL that isn't a page, but a
// route.ts's or a sitemap.ts's: a payload that has the browser load it as a
// document.
export function documentResponse(ctx: Context): Response {
  return payloadResponse({
    root: null,
    pathname: getUrl(ctx).pathname,
    search: getUrl(ctx).search,
    document: true,
  })
}

function payloadResponse(payload: RscPayload): Response {
  return new Response(renderToReadableStream<RscPayload>(payload), {
    headers: { 'content-type': 'text/x-component;charset=utf-8' },
  })
}
