import { redirect } from 'next/navigation'
import { getServices } from '@cms/services/getServices'
import { AuthTokenStore } from '@cms/services/AuthTokenStore'
import { MeClient } from './MeClient'
import { WithBreadcrumbs } from '../BreadCrumbs/Breadcrumbs'

export default async function MePage() {
  const services = await getServices()
  const { authData } = services
  if (!authData) {
    redirect('/manage/login?next=/manage/me')
  }

  const otherSessions = await new AuthTokenStore(services.derivedDb).countOthersForUser(
    authData.user.id,
    authData.token,
  )

  return (
    <WithBreadcrumbs items={[{ name: 'Dashboard', url: '/manage' }, { name: 'Me' }]}>
      <MeClient user={authData.user} otherSessions={otherSessions} />
    </WithBreadcrumbs>
  )
}
