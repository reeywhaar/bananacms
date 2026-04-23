import { COOKIE_MAX_AGE_SECONDS } from '@cms/services/AuthTokenStore'
import { NextResponse } from 'next/server'

export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set('auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
}
