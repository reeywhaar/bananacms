'use server'

import { setTimeout as sleep } from 'node:timers/promises'
import { defineAction } from '../../framework/actions.ts'
import { redirect } from '../../framework/redirect.ts'
import { adminAction } from '../../lib/adminAction.ts'
import { ApiError } from '../../lib/api/error.ts'
import {
  LOGIN_PATH,
  logIn,
  logOut,
  pathAfterLogin,
  requireAuth,
  setPasswordWithToken,
} from '../../lib/auth.ts'
import { AuthTokenStore } from '../../services/AuthTokenStore.ts'
import { hashPassword, verifyPassword } from '../../services/password.ts'
import { UserStore } from '../../services/UserStore.ts'
import { getDb, getDerivedDb, getLogger, getUrl } from '../../framework/context.ts'
import { MANAGE_PATH } from '../../framework/request.ts'

// The username goes back into the form after a failure: React resets a form once
// its action is done, and the field's default value comes from this state.
export type LoginState = { error: string; username: string }

// Signs in, and goes on to the page in the login page's `next` parameter.
export const login = defineAction(
  async (ctx, _state: LoginState, formData: FormData): Promise<LoginState> => {
    const username = String(formData.get('username') ?? '')
    const password = String(formData.get('password') ?? '')
    if (await logIn(ctx, username, password)) {
      redirect(pathAfterLogin(getUrl(ctx).searchParams.get('next')))
    }
    await sleep(500) // slows down password guessing a little
    return { error: 'Wrong username or password.', username }
  },
)

// Sets the password with the token of an invitation or a recovery link, whose
// page the form is on, and goes on to the admin signed in (setPasswordWithToken)
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
