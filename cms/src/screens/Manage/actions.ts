'use server'

import { setTimeout as sleep } from 'node:timers/promises'
import { defineAction } from '#cms/framework/actions.ts'
import { redirect } from '#cms/framework/redirect.ts'
import { adminAction } from '#cms/lib/adminAction.ts'
import { ApiError } from '#cms/lib/api/error.ts'
import {
  LOGIN_PATH,
  logIn,
  logOut,
  pathAfterLogin,
  requireAuth,
  setPasswordWithToken,
} from '#cms/lib/auth.ts'
import { AuthTokenStore } from '#cms/services/AuthTokenStore.ts'
import { hashPassword, verifyPassword } from '#cms/services/password.ts'
import { UserStore } from '#cms/services/UserStore.ts'
import { getDb, getDerivedDb, getLogger, getUrl } from '#cms/framework/context.ts'
import { MANAGE_PATH } from '#cms/framework/request.ts'

// The username goes back into the form after a failure: React resets a form once
// its action is done, and the field's default value comes from this state.
export type LoginState = { error: string; username: string }

// Signs in, and goes on to the page in the login page's `next` parameter. Public:
// it's what a visitor without a session posts.
export const login = defineAction(
  async (ctx, _state: LoginState, formData: FormData): Promise<LoginState> => {
    const username = String(formData.get('username') ?? '')
    const password = String(formData.get('password') ?? '')
    const result = await logIn(ctx, username, password)
    if (result.ok) redirect(pathAfterLogin(getUrl(ctx).searchParams.get('next')))
    await sleep(500) // slows down password guessing a little
    if (result.waitMs === 0) return { error: 'Wrong username or password.', username }
    const minutes = Math.ceil(result.waitMs / 60_000)
    return {
      error: `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      username,
    }
  },
  { public: true },
)

// Sets the password with the token of an invitation or a recovery link, whose
// page the form is on, and goes on to the admin signed in (setPasswordWithToken).
// Public: the token is what lets it in.
export const setPassword = defineAction(
  async (ctx, _state: { error: string }, formData: FormData): Promise<{ error: string }> => {
    const password = String(formData.get('password') ?? '')
    if (password !== String(formData.get('confirm') ?? '')) {
      return { error: "The passwords don't match." }
    }
    const error = await setPasswordWithToken(ctx, String(formData.get('token') ?? ''), password)
    if (error) return { error }
    redirect(MANAGE_PATH)
  },
  { public: true },
)

// Ends the session. The login page it goes to comes back to the current page.
export const logout = defineAction(async (ctx) => {
  await logOut(ctx)
  const { pathname, search } = getUrl(ctx)
  redirect(`${LOGIN_PATH}?next=${encodeURIComponent(pathname + search)}`)
})

// The hashes are of the passwords' SHA-256, which the page computes (MeClient).
export const changePassword = adminAction(
  async (ctx, currentHash: string, newHash: string): Promise<void> => {
    const users = new UserStore(getDb(ctx))
    const log = getLogger(ctx).child('Auth')
    const user = await users.findById(requireAuth(ctx).user.id)
    if (!user) throw new ApiError('Unauthorized').expose().withStatus(401)
    if (!(await verifyPassword(currentHash, user.password_hash))) {
      log.warn('password.change.failure', { userId: user.id, reason: 'wrongCurrent' })
      throw new ApiError('Current password is incorrect').expose().withStatus(401)
    }
    await users.updatePasswordHash(user.id, await hashPassword(newHash))
    log.info('password.change.success', { userId: user.id })
  },
)

export const revokeOtherSessions = adminAction(async (ctx): Promise<{ revoked: number }> => {
  const { user, token } = requireAuth(ctx)
  const revoked = await new AuthTokenStore(getDerivedDb(ctx)).revokeOthersForUser(user.id, token)
  getLogger(ctx).child('Auth').info('sessions.revokeOthers', { userId: user.id, revoked })
  return { revoked }
})
