'use client'

import { useActionState } from 'react'
import { login } from '../actions.ts'

// The login form, posting to the login action: it works without JavaScript too, and
// signs in to the page in the URL's `next` parameter.
export default function LoginClient() {
  const [state, formAction, pending] = useActionState(login, { error: '', username: '' })

  return (
    <main className="hero flex items-center justify-center p-4">
      <form
        action={formAction}
        className="flex flex-col gap-4 w-full max-w-sm p-8 border border-gray-200 rounded-xl shadow-sm"
      >
        <h1 className="text-2xl font-bold text-center">Login</h1>
        <input
          id="username"
          name="username"
          type="text"
          placeholder="Username"
          defaultValue={state?.username}
          required
          autoComplete="username"
          className="border border-gray-200 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-gray-400"
        />
        <input
          id="password"
          name="password"
          type="password"
          placeholder="Password"
          required
          autoComplete="current-password"
          className="border border-gray-200 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-gray-400"
        />
        {state?.error && <p className="text-red-600 text-sm">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="bg-black text-white rounded px-4 py-2 hover:bg-gray-800 disabled:opacity-50"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
