import type { Context } from '../../../framework/context.ts'
import { redirect } from '../../../framework/redirect.ts'
import { AuthTokenStore } from '../../../services/AuthTokenStore.ts'
import { WithBreadcrumbs } from '../BreadCrumbs/Breadcrumbs.tsx'
import { MeClient } from './MeClient.tsx'
import { getDerivedDb, getAuth } from '../../../framework/context.ts'

export default async function MePage({ ctx }: { ctx: Context }) {
  const auth = getAuth(ctx)
  if (!auth) {
    redirect('/manage/login?next=/manage/me')
  }

  const otherSessions = await new AuthTokenStore(getDerivedDb(ctx)).countOthersForUser(
    auth.user.id,
    auth.token,
  )

  return (
    <WithBreadcrumbs items={[{ name: 'Dashboard', url: '/manage' }, { name: 'Me' }]}>
      <MeClient user={auth.user} otherSessions={otherSessions} />
    </WithBreadcrumbs>
  )
}
