'use client'

import { FC, SyntheticEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApiDispatcher } from '@cms/components/ApiDispatcherProvider/ApiDispatcherProvider'
import { useWithProgress } from '@cms/components/ProgressOverlay/ProgressOverlay'
import { useToast } from '@cms/components/Toast/Toast'
import { useEvent } from '@cms/hooks/useEvent'
import { changePassword, revokeOtherSessions } from '@cms/lib/api/me'
import { extractErrorMessage } from '@cms/utils/extractErrorMessage'
import { pluralize } from '@cms/utils/pluralize'

export const MeClient: FC<{
  user: { id: string; name: string }
  otherSessions: number
}> = ({ user, otherSessions }) => {
  const dispatcher = useApiDispatcher()
  const withProgress = useWithProgress()
  const showToast = useToast()
  const router = useRouter()
  const [pwError, setPwError] = useState<string | null>(null)

  const handlePasswordSubmit = useEvent(async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPwError(null)
    const form = e.currentTarget
    const current = (form.elements.namedItem('current') as HTMLInputElement).value
    const next = (form.elements.namedItem('next') as HTMLInputElement).value
    const confirm = (form.elements.namedItem('confirm') as HTMLInputElement).value
    if (next !== confirm) {
      setPwError('New password and confirmation do not match.')
      return
    }
    if (next.length < 8) {
      setPwError('New password must be at least 8 characters.')
      return
    }
    await withProgress(async () => {
      try {
        const [currentHash, newHash] = await Promise.all([sha256hex(current), sha256hex(next)])
        await dispatcher.dispatch(changePassword(currentHash, newHash))
        form.reset()
        showToast('info', 'Password updated.', { timeout: 2000 })
      } catch (err) {
        setPwError(extractErrorMessage(err))
      }
    })
  })

  const handleRevoke = useEvent(async () => {
    if (otherSessions === 0) return
    if (
      !window.confirm(
        `Revoke ${otherSessions} other ${pluralize(otherSessions, { one: 'session', other: 'sessions' })}`,
      )
    )
      return
    await withProgress(async () => {
      try {
        const { revoked } = await dispatcher.dispatch(revokeOtherSessions())
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
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Change password</h2>
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
          <label className="label">
            <span>Current password</span>
            <input
              type="password"
              name="current"
              required
              autoComplete="current-password"
              className="input"
            />
          </label>
          <label className="label">
            <span>New password</span>
            <input
              type="password"
              name="next"
              required
              minLength={8}
              autoComplete="new-password"
              className="input"
            />
          </label>
          <label className="label">
            <span>Confirm new password</span>
            <input
              type="password"
              name="confirm"
              required
              minLength={8}
              autoComplete="new-password"
              className="input"
            />
          </label>
          {pwError && <p className="text-red-600 text-sm">{pwError}</p>}
          <div className="flex justify-end">
            <button type="submit" className="button">
              Update password
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Other sessions</h2>
        <p className="text-sm text-gray-600 mb-2">
          {otherSessions === 0
            ? 'No other active sessions.'
            : `${otherSessions} other active ${pluralize(otherSessions, { one: 'session', other: 'sessions' })}.`}
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            className="button-danger"
            onClick={handleRevoke}
            disabled={otherSessions === 0}
          >
            Revoke other sessions
          </button>
        </div>
      </section>
    </main>
  )
}

async function sha256hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
