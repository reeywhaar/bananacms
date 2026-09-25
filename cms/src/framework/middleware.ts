import type { Context } from './context.ts'

// Koa-style middleware. It gets the request's ctx and `next`, which runs the rest
// of the chain (the later middleware, then the page or action) and returns its
// Response. A middleware can change that response, or return its own instead of
// calling `next`.
export type Middleware = (ctx: Context, next: () => Promise<Response>) => Promise<Response>

// Runs `middleware` in order, with `last` at the end of the chain.
export function runMiddleware(
  ctx: Context,
  middleware: readonly Middleware[],
  last: () => Promise<Response>,
): Promise<Response> {
  let reached = -1
  const dispatch = async (index: number): Promise<Response> => {
    if (index <= reached) throw new Error('A middleware called next() more than once')
    reached = index
    const current = middleware[index]
    return current ? current(ctx, () => dispatch(index + 1)) : last()
  }
  return dispatch(0)
}
