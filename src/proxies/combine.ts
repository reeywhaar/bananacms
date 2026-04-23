import { NextProxy, NextRequest, NextFetchEvent, NextResponse } from 'next/server'

export type Awaitable<T> = T | PromiseLike<T>

export type ProxyMiddleware = (
  request: NextRequest,
  event: NextFetchEvent,
  next: () => Awaitable<NextResponse>,
) => Promise<NextResponse>

export function combineProxies(...proxies: ProxyMiddleware[]): NextProxy {
  return async (request, event) => {
    const dispatch = (idx: number): (() => Promise<NextResponse>) => {
      let cached: Promise<NextResponse> | undefined
      return () => {
        if (cached) return cached
        cached = Promise.resolve().then<NextResponse>(() => {
          if (idx >= proxies.length) return NextResponse.next()
          return Promise.resolve(proxies[idx](request, event, dispatch(idx + 1)))
        })
        return cached
      }
    }
    return dispatch(0)()
  }
}

export function adaptNextProxy(proxy: NextProxy): ProxyMiddleware {
  return async (request, event, next) => {
    const result = await proxy(request, event)
    if (result != null) return result as NextResponse
    return next()
  }
}
