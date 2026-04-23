import { getServices } from '@cms/services/getServices'
import { NextResponse } from 'next/server'
import type { ProxyMiddleware } from './combine'

interface AuthProxyConfig {
  protected: string[]
  loginPath: string
}

export function createAuthProxy({
  protected: protectedPaths,
  loginPath,
}: AuthProxyConfig): ProxyMiddleware {
  return async (request, _event, next) => {
    const { pathname } = request.nextUrl
    const isProtected = protectedPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))
    if (!isProtected) return next()

    const { authData } = await getServices()
    const loggedIn = authData.loggedIn
    const isLoginPath = pathname === loginPath || pathname.startsWith(loginPath + '/')
    if (isLoginPath) {
      if (loggedIn) {
        const target = request.nextUrl.searchParams.get('next') ?? protectedPaths[0]
        return NextResponse.redirect(new URL(target, request.url))
      }
      return NextResponse.next()
    }
    if (!loggedIn) {
      const loginUrl = new URL(loginPath, request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }
}
