import { createRouteHandler } from '@cms/lib/routeHandler'
import { getServices } from '@cms/services/getServices'
import { hashPassword, verifyPassword } from '@cms/services/password'
import { UserStore } from '@cms/services/UserStore'
import { intoResult } from '@cms/utils/result'
import { valita } from '@cms/utils/valita'
import { NextResponse } from 'next/server'

export const PUT = createRouteHandler(async (request) => {
  const services = await getServices()
  const userStore = new UserStore(services.db)
  const log = services.rootLogger.child('Auth')
  const { authData } = services
  if (!authData) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const bodyResult = await intoResult(() => request.json())
  if (bodyResult.error) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = intoResult(() =>
    valita
      .object({ currentHash: valita.string(), newHash: valita.string() })
      .parse(bodyResult.value),
  )
  if (parsed.error) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  const { currentHash, newHash } = parsed.value

  const user = await userStore.findById(authData.user.id)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await verifyPassword(currentHash, user.password_hash))) {
    log.warn('password.change.failure', { userId: user.id, reason: 'wrongCurrent' })
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
  }

  const newStored = await hashPassword(newHash)
  await userStore.updatePasswordHash(user.id, newStored)
  log.info('password.change.success', { userId: user.id })

  return new NextResponse(null, { status: 204 })
})
