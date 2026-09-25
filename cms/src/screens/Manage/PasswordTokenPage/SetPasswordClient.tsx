'use client'

import { useActionState } from 'react'
import type { PasswordTokenKind } from '../../../services/PasswordTokenStore.ts'
import { setPassword } from '../actions.ts'

const inputClass =
  'border border-gray-200 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-gray-400'

// The form of an invitation or a recovery link, posting to the setPassword
// action, which signs in: it works without JavaScript too, as the login form does.
export default function SetPasswordClient({
  kind,
  name,
  token,
  minLength,
}: {
  kind: PasswordTokenKind
  name: string
  token: string
  minLength: number
}) {
  const [state, formAction, pending] = useActionState(setPassword, { error: '' })

  return (
    <main className="hero flex items-center justify-center p-4">
      <form
        action={formAction}
        className="flex flex-col gap-4 w-full max-w-sm p-8 border border-gray-200 rounded-xl shadow-sm"
      >
        <h1 className="text-2xl font-bold text-center">
          {kind === 'invite' ? 'Welcome' : 'New password'}
        </h1>
        <p className="text-sm text-gray-600 text-center">
          {kind === 'invite'
            ? 'Set the password you will sign in with.'
            : 'Set a new password to sign in with.'}
        </p>
        <input type="hidden" name="token" value={token} />
        {/* the name, which password managers save the password under */}
        <input
          name="username"
          type="text"
          value={name}
          readOnly
          autoComplete="username"
          className={`${inputClass} bg-gray-50 text-gray-600`}
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          minLength={minLength}
          autoComplete="new-password"
          className={inputClass}
        />
        <input
          name="confirm"
          type="password"
          placeholder="Password again"
          required
          minLength={minLength}
          autoComplete="new-password"
          className={inputClass}
        />
        {state.error && <p className="text-red-600 text-sm">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="bg-black text-white rounded px-4 py-2 hover:bg-gray-800 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Set password and sign in'}
        </button>
      </form>
    </main>
  )
}
