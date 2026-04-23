import { redirect } from 'next/navigation'
import { getServices } from '@cms/services/getServices'
import { MeClient } from './MeClient'
import { WithBreadcrumbs } from '../BreadCrumbs/Breadcrumbs'
import { AuthTokenStore } from '@cms/services/AuthTokenStore'

export default async function MePage() {
  const services = await getServices()
  const { authData } = services
  if (!authData.loggedIn || !authData.user || !authData.token) {
    redirect('/manage/login?next=/manage/me')
  }

  const otherSessions = await new AuthTokenStore(services.db).countOthersForUser(
    authData.user.id,
    authData.token,
  )

  return (
    <WithBreadcrumbs items={[{ name: 'Dashboard', url: '/manage' }, { name: 'Me' }]}>
      <MeClient user={authData.user} otherSessions={otherSessions} />
    </WithBreadcrumbs>
  )
}
