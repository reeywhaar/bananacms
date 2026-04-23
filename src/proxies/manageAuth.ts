import { AuthTokenStore } from '@cms/services/AuthTokenStore'
import { setAuthCookie } from '@cms/lib/authCookie'
import { getServices } from '@cms/services/getServices'
import { NextResponse } from 'next/server'
import type { ProxyMiddleware } from './combine'

const REFRESH_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000

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

    const services = await getServices()
    const { authData } = services
    const isLoginPath = pathname === loginPath || pathname.startsWith(loginPath + '/')
    if (isLoginPath) {
      if (authData) {
        const target = request.nextUrl.searchParams.get('next') ?? protectedPaths[0]
        return NextResponse.redirect(new URL(target, request.url))
      }
      return NextResponse.next()
    }
    if (!authData) {
      const loginUrl = new URL(loginPath, request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const needsRefresh =
      new Date(authData.tokenExpiresAt).getTime() - Date.now() < REFRESH_THRESHOLD_MS
    if (needsRefresh) {
      await new AuthTokenStore(services.db).extend(authData.token)
      const response = NextResponse.next()
      setAuthCookie(response, authData.token)
      return response
    }

    return NextResponse.next()
  }
}
