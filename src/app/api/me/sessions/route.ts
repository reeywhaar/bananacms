import { createRouteHandler } from '@cms/lib/routeHandler'
import { AuthTokenStore } from '@cms/services/AuthTokenStore'
import { getServices } from '@cms/services/getServices'
import { NextResponse } from 'next/server'

export const DELETE = createRouteHandler(async () => {
  const services = await getServices()
  const { authData } = services
  if (!authData) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const revoked = await new AuthTokenStore(services.db).revokeOthersForUser(
    authData.user.id,
    authData.token,
  )
  services.rootLogger
    .child('Auth')
    .info('sessions.revokeOthers', { userId: authData.user.id, revoked })

  return NextResponse.json({ revoked })
})
