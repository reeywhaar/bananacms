'use client'

import { type FC, useState } from 'react'
import { useRouter } from '#cms/framework/navigation.ts'
import { useWithProgress } from '#cms/components/ProgressOverlay/ProgressOverlay.tsx'
import { useToast } from '#cms/components/Toast/Toast.tsx'
import { useConfirm } from '#cms/components/Confirm/Confirm.tsx'
import { useEvent } from '#cms/hooks/useEvent.ts'
import { handleServerResult } from '#cms/lib/serverActions.ts'
import { logout, revokeOtherSessions } from '../actions.ts'
import { ChangePasswordDialog } from './ChangePasswordDialog.tsx'
import { extractErrorMessage } from '#cms/utils/extractErrorMessage.ts'
import { pluralize } from '#cms/utils/pluralize.ts'

export const MeClient: FC<{
  user: { id: string; name: string }
  otherSessions: number
}> = ({ user, otherSessions }) => {
  const withProgress = useWithProgress()
  const showToast = useToast()
  const confirm = useConfirm()
  const router = useRouter()
  const [changingPassword, setChangingPassword] = useState(false)

  const handleRevoke = useEvent(async () => {
    if (
      !(await confirm({
        title: `Revoke ${otherSessions} other ${pluralize(otherSessions, { one: 'session', other: 'sessions' })}?`,
        message: `${pluralize(otherSessions, { one: 'It', other: 'They' })} will be signed out.`,
        action: 'Revoke',
        danger: true,
      }))
    )
      return
    await withProgress(async () => {
      try {
        const { revoked } = handleServerResult(await revokeOtherSessions())
        showToast(
          'info',
          `Revoked ${revoked} ${pluralize(revoked, { one: 'session', other: 'sessions' })}.`,
          { timeout: 2000 },
        )
        router.refresh()
      } catch (err) {
        showToast('error', extractErrorMessage(err), { timeout: 3000 })
      }
    })
  })

  return (
    <main className="p-4 flex flex-col gap-6 max-w-md">
      <section>
        <h1 className="text-2xl font-bold mb-2">Account</h1>
        <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-gray-500">Username</dt>
          <dd>{user.name}</dd>
          <dt className="text-gray-500">User ID</dt>
          <dd className="font-mono break-all">{user.id}</dd>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="button" onClick={() => setChangingPassword(true)}>
            Change password…
          </button>
          <form action={logout} className="flex">
            <button className="button">Logout</button>
          </form>
        </div>
        {changingPassword && <ChangePasswordDialog onClose={() => setChangingPassword(false)} />}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Other sessions</h2>
        <p className="text-sm text-gray-600 mb-2">
          {otherSessions === 0
            ? 'No other active sessions.'
            : `${otherSessions} other active ${pluralize(otherSessions, { one: 'session', other: 'sessions' })}.`}
        </p>
        {otherSessions > 0 && (
          <div className="flex">
            <button type="button" className="button-danger" onClick={handleRevoke}>
              Revoke other sessions…
            </button>
          </div>
        )}
      </section>
    </main>
  )
}
