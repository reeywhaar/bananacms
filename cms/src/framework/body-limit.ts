// The most a request's body can hold: 100 MB with a session, where uploads come
// from, and 1 MB without, which is plenty for the forms of the public actions,
// like a login or a vote
export const MAX_BODY_BYTES = { signedIn: 100 * 1024 * 1024, signedOut: 1024 * 1024 }

// `maxBytes()` is asked as the body is read, so it can depend on what the
// middleware found out about the request, like its session; `exceeded` says the
// read stopped at it.
export type BodyLimit = { maxBytes: () => number; exceeded: boolean }

// The request, its body counted as it's read: past `limit.maxBytes()` the read
// fails, and `limit.exceeded` is set.
export function limitBody(request: Request, limit: BodyLimit): Request {
  if (!request.body) return request
  let read = 0
  const body = request.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        read += chunk.byteLength
        if (read > limit.maxBytes()) {
          limit.exceeded = true
          controller.error(new Error(`The request's body is over ${limit.maxBytes()} bytes`))
        } else {
          controller.enqueue(chunk)
        }
      },
    }),
  )
  // Made from its parts: the servers hand over requests of their own class, which
  // Request's constructor doesn't take for one. A stream body needs `duplex`, which
  // the DOM's RequestInit type leaves out.
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    signal: request.signal,
    body,
    duplex: 'half',
  } as RequestInit)
}

// whether the request's Content-Length says its body is over the limit, so it can
// be turned away unread
export function declaredOverLimit(request: Request, limit: BodyLimit): boolean {
  return Number(request.headers.get('content-length')) > limit.maxBytes()
}

// The answer to a body over the limit, which is left unread. The connection closes
// after it, as the rest of the body would come before the client's next request.
export function payloadTooLarge(): Response {
  return new Response('Payload Too Large', {
    status: 413,
    headers: { 'content-type': 'text/plain', connection: 'close' },
  })
}
