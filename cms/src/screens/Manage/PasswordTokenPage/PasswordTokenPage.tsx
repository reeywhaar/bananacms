import type { Context } from '../../../framework/context.ts'
import { getUrl } from '../../../framework/context.ts'
import {
  LINK_GONE,
  LOGIN_PATH,
  MIN_PASSWORD_LENGTH,
  passwordTokenUserName,
} from '../../../lib/auth.ts'
import type { PasswordTokenKind } from '../../../services/PasswordTokenStore.ts'
import SetPasswordClient from './SetPasswordClient.tsx'

// The pages of the links `bananacms user create` and `user reset` print,
// /manage/invite and /manage/recover, where the user sets a password
export default async function PasswordTokenPage({
  ctx,
  kind,
}: {
  ctx: Context
  kind: PasswordTokenKind
}) {
  const token = getUrl(ctx).searchParams.get('token') ?? ''
  const name = token ? await passwordTokenUserName(ctx, kind, token) : undefined
  if (name === undefined) {
    return (
      <main className="hero flex items-center justify-center p-4">
        <div className="flex flex-col gap-4 w-full max-w-sm p-8 border border-gray-200 rounded-xl shadow-sm text-center">
          <h1 className="text-2xl font-bold">Link expired</h1>
          <p className="text-sm text-gray-600">{LINK_GONE} Ask for a new one.</p>
          <a href={LOGIN_PATH} className="underline">
            Sign in
          </a>
        </div>
      </main>
    )
  }
  return <SetPasswordClient kind={kind} name={name} token={token} minLength={MIN_PASSWORD_LENGTH} />
}
