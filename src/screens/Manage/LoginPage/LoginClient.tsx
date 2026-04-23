'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { SyntheticEvent, useState } from 'react'
import { ApiError, RequestError } from '@cms/lib/api/Dispatcher'
import { postAuth } from '@cms/lib/api/auth'
import { useApiDispatcher } from '@cms/components/ApiDispatcherProvider/ApiDispatcherProvider'

export default function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dispatcher = useApiDispatcher()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const username = (e.currentTarget.elements.namedItem('username') as HTMLInputElement).value
      const password = (e.currentTarget.elements.namedItem('password') as HTMLInputElement).value
      const hash = await sha256hex(password)
      await dispatcher.dispatch(postAuth(username, hash))
      router.replace(searchParams.get('next') ?? '/manage')
      router.refresh()
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message)
      } else if (e instanceof RequestError) {
        setError(e.message)
      } else {
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="hero flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 w-full max-w-sm p-8 border border-gray-200 rounded-xl shadow-sm"
      >
        <h1 className="text-2xl font-bold text-center">Login</h1>
        <input
          id="username"
          name="username"
          type="text"
          placeholder="Username"
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
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white rounded px-4 py-2 hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
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
