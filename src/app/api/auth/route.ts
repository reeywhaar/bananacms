import { createRouteHandler } from '@cms/lib/routeHandler'
import { AuthTokenStore } from '@cms/services/AuthTokenStore'
import { setAuthCookie } from '@cms/lib/authCookie'
import { getServices } from '@cms/services/getServices'
import { verifyPassword } from '@cms/services/password'
import { UserStore } from '@cms/services/UserStore'
import { intoResult } from '@cms/utils/result'
import { valita } from '@cms/utils/valita'
import { NextResponse } from 'next/server'

const DUMMY_HASH =
  'scrypt$N=16384,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

export const POST = createRouteHandler(async (request) => {
  const services = await getServices()
  const userStore = new UserStore(services.db)
  const authTokenStore = new AuthTokenStore(services.db)
  const log = services.rootLogger.child('Auth')
  const bodyResult = await intoResult(() => request.json())
  if (bodyResult.error) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = intoResult(() =>
    valita.object({ username: valita.string(), hash: valita.string() }).parse(bodyResult.value),
  )
  if (parsed.error) {
    return NextResponse.json({ error: 'Invalid credentials payload' }, { status: 400 })
  }
  const { username, hash } = parsed.value

  log.info('login.attempt', { username })

  const user = await userStore.findByName(username)
  const ok = await verifyPassword(hash, user?.password_hash ?? DUMMY_HASH)

  if (!user || !ok) {
    log.warn('login.failure', { username, reason: !user ? 'unknownUser' : 'badPassword' })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { token } = await authTokenStore.issue(user.id)

  const response = new NextResponse(null, { status: 204 })
  setAuthCookie(response, token)
  log.info('login.success', { userId: user.id, username })
  return response
})

export const DELETE = createRouteHandler(async (request) => {
  const services = await getServices()
  const authTokenStore = new AuthTokenStore(services.db)
  const log = services.rootLogger.child('Auth')
  const token = request.cookies.get('auth')?.value
  if (token) {
    await authTokenStore.revoke(token)
  }
  log.info('logout', { hadToken: Boolean(token) })

  const response = new NextResponse(null, { status: 204 })
  response.cookies.delete('auth')
  return response
})
