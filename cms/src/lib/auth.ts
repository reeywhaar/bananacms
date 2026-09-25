import 'server-only'
import {
  getAuth,
  getCookies,
  getDb,
  getDerivedDb,
  getLogger,
  getRequest,
  getUrl,
  setAuth,
  type Auth,
  type Context,
} from '../framework/context.ts'
import type { Middleware } from '../framework/middleware.ts'
import { redirect } from '../framework/redirect.ts'
import { MANAGE_PATH, isManagePath } from '../framework/request.ts'
import { AuthTokenStore, COOKIE_MAX_AGE_SECONDS } from '../services/AuthTokenStore.ts'
import { hashUserPassword, sha256hex, verifyPassword } from '../services/password.ts'
import {
  PASSWORD_TOKEN_PATHS,
  PasswordTokenStore,
  type PasswordTokenKind,
} from '../services/PasswordTokenStore.ts'
import { UserStore } from '../services/UserStore.ts'
import { ApiError } from './api/error.ts'

// Sessions for CMS users: a token in derived.db's authtoken table, sent back in the
// `auth` cookie.
export const AUTH_COOKIE = 'auth'

export const LOGIN_PATH = `${MANAGE_PATH}/login`

export const LINK_GONE =
  "This link doesn't work any more: it has been used or has expired, or a newer one has replaced it."

export const MIN_PASSWORD_LENGTH = 8

// a session with less time left than this is extended
const REFRESH_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000

// verified against when the user doesn't exist, so both cases take as long
const DUMMY_HASH =
  'scrypt$N=16384,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

// Puts the session's user in ctx (getAuth), from the session cookie, and extends
// a session that's close to expiring. A request without the cookie makes no queries.
export const authenticate: Middleware = async (ctx, next) => {
  const token = getCookies(ctx).get(AUTH_COOKIE)
  const tokens = new AuthTokenStore(getDerivedDb(ctx))
  const session = token ? await tokens.getTokenData(token) : undefined
  const user = session ? await new UserStore(getDb(ctx)).findById(session.userId) : undefined
  if (!token || !session || !user) {
    getLogger(ctx).set({ auth: { type: token ? 'invalidToken' : 'guest' } })
    return next()
  }

  let expiresAt = session.expiresAt
  if (new Date(expiresAt).getTime() - Date.now() < REFRESH_THRESHOLD_MS) {
    expiresAt = await tokens.extend(token)
    getCookies(ctx).set(AUTH_COOKIE, token, { maxAge: COOKIE_MAX_AGE_SECONDS })
  }
  setAuth(ctx, { user: { id: user.id, name: user.name }, token, tokenExpiresAt: expiresAt })
  getLogger(ctx).set({ auth: { type: 'user', id: user.id } })
  return next()
}

// Checks a name and password against the user table, and on a match starts a
// session.
export async function logIn(ctx: Context, name: string, password: string): Promise<boolean> {
  const log = getLogger(ctx).child('Auth')
  log.info('login.attempt', { username: name })
  const user = await new UserStore(getDb(ctx)).findByName(name)
  const ok = await verifyPassword(sha256hex(password), user?.password_hash ?? DUMMY_HASH)
  if (!user || !ok) {
    log.warn('login.failure', { username: name, reason: user ? 'badPassword' : 'unknownUser' })
    return false
  }

  await startSession(ctx, user)
  log.info('login.success', { userId: user.id, username: name })
  return true
}

async function startSession(ctx: Context, user: { id: string; name: string }): Promise<void> {
  const { token, expiresAt } = await new AuthTokenStore(getDerivedDb(ctx)).issue(user.id)
  getCookies(ctx).set(AUTH_COOKIE, token, { maxAge: COOKIE_MAX_AGE_SECONDS })
  setAuth(ctx, { user: { id: user.id, name: user.name }, token, tokenExpiresAt: expiresAt })
}

// The name of the user an invitation or a recovery link is for, while it works,
// for its page: the name the invitation creates, or the recovery link's user's
export async function passwordTokenUserName(
  ctx: Context,
  kind: PasswordTokenKind,
  token: string,
): Promise<string | undefined> {
  const target = await new PasswordTokenStore(getDerivedDb(ctx)).find(token)
  if (target?.kind !== kind) return undefined
  if (target.kind === 'invite') return target.userName
  return (await new UserStore(getDb(ctx)).findById(target.userId))?.name
}

// Sets `password` for the user of an invitation or a recovery link, which then
// works no more, and signs in as them, in place of the browser's session. An
// invitation creates its user, and a recovery link ends its user's sessions.
// Returns what went wrong, if something did.
export async function setPasswordWithToken(
  ctx: Context,
  token: string,
  password: string,
): Promise<string | undefined> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `The password needs at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  const log = getLogger(ctx).child('Auth')
  const target = await new PasswordTokenStore(getDerivedDb(ctx)).consume(token)
  const users = new UserStore(getDb(ctx))
  const sessions = new AuthTokenStore(getDerivedDb(ctx))
  const passwordHash = await hashUserPassword(password)

  let user: { id: string; name: string } | undefined
  if (target?.kind === 'invite') {
    if (await users.findByName(target.userName)) {
      log.warn('invite.failure', { username: target.userName, reason: 'nameTaken' })
      return `There is a user "${target.userName}" already.`
    }
    user = { ...(await users.create(target.userName, passwordHash)), name: target.userName }
    log.info('invite.accepted', { userId: user.id, username: user.name })
  } else if (target?.kind === 'recover') {
    user = await users.findById(target.userId)
    if (user) {
      await users.updatePasswordHash(user.id, passwordHash)
      await sessions.revokeAllForUser(user.id)
      log.info('recover.success', { userId: user.id, username: user.name })
    }
  }
  if (!user) {
    log.warn('passwordToken.invalid')
    return LINK_GONE
  }

  const current = getCookies(ctx).get(AUTH_COOKIE)
  if (current) await sessions.revoke(current)
  await startSession(ctx, user)
  return undefined
}

export async function logOut(ctx: Context): Promise<void> {
  const token = getCookies(ctx).get(AUTH_COOKIE)
  if (token) await new AuthTokenStore(getDerivedDb(ctx)).revoke(token)
  getCookies(ctx).delete(AUTH_COOKIE)
  setAuth(ctx, undefined)
  getLogger(ctx)
    .child('Auth')
    .info('logout', { hadToken: Boolean(token) })
}

// /manage needs a signed-in user, but for the login page and the pages of the
// invitations and recovery links. A page request without a session goes to the
// login page, with the page it asked for in `next`, and the login page sends a
// signed-in user on there. Server actions can be posted to any URL, so they check
// getAuth(ctx) themselves (requireAuth).
export const manageGate: Middleware = async (ctx, next) => {
  const { pathname, search } = getUrl(ctx)
  if (getRequest(ctx).method !== 'GET' || !isManagePath(pathname)) return next()
  const path = pathname.replace(/\/+$/, '')
  const open = path === LOGIN_PATH || Object.values(PASSWORD_TOKEN_PATHS).includes(path)
  if (!getAuth(ctx) && !open) {
    redirect(`${LOGIN_PATH}?next=${encodeURIComponent(pathname + search)}`)
  }
  if (getAuth(ctx) && path === LOGIN_PATH) {
    redirect(pathAfterLogin(getUrl(ctx).searchParams.get('next')))
  }
  return next()
}

// Where the login page sends a signed-in user: `next` when it's a path within
// /manage, so the parameter can't send anyone to another site.
export function pathAfterLogin(next: string | null): string {
  if (next?.startsWith('/') && !next.startsWith('//')) {
    const url = new URL(next, 'http://manage.invalid')
    if (url.host === 'manage.invalid' && isManagePath(url.pathname)) {
      return url.pathname + url.search
    }
  }
  return MANAGE_PATH
}

// the signed-in user, failing a server action for visitors who aren't signed in
export function requireAuth(ctx: Context): Auth {
  const auth = getAuth(ctx)
  if (!auth) throw new ApiError('Unauthorized').expose().withStatus(401)
  return auth
}
