import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { authtoken } from './db/derivedSchema.ts'
import { AuthTokenStore } from '../services/AuthTokenStore.ts'
import { hashPassword, sha256hex } from '../services/password.ts'
import { PasswordTokenStore } from '../services/PasswordTokenStore.ts'
import { UserStore } from '../services/UserStore.ts'
import { createTestContext } from '../test/context.ts'
import { createTestDb, type TestDb } from '../test/db.ts'
import {
  authenticate,
  LINK_GONE,
  logIn,
  logOut,
  manageGate,
  passwordTokenUserName,
  setPasswordWithToken,
} from './auth.ts'
import { getLogger, getCookies, getAuth } from '../framework/context.ts'
import { redirectTarget } from '../framework/redirect.ts'

// a user whose stored hash is the scrypt of the password's SHA-256 hex
async function addUser(testDb: TestDb, name: string, password: string) {
  return new UserStore(testDb.db).create(name, await hashPassword(sha256hex(password)))
}

async function authenticated(testDb: TestDb, cookie?: string) {
  const { ctx, entries } = createTestContext({ testDb, cookie })
  const response = await authenticate(ctx, async () => new Response('page'))
  return { ctx, entries, response }
}

describe('logIn', () => {
  it('starts a session for the right name and password', async () => {
    using testDb = await createTestDb()
    const { id } = await addUser(testDb, 'alice', 'secret')
    const { ctx, entries } = createTestContext({ testDb })

    expect(await logIn(ctx, 'alice', 'secret')).toBe(true)
    expect(getAuth(ctx)?.user).toEqual({ id, name: 'alice' })
    expect(getCookies(ctx).setCookieHeaders).toEqual([
      `auth=${getAuth(ctx)?.token}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax`,
    ])
    expect(await new AuthTokenStore(testDb.derivedDb).getUserId(getAuth(ctx)!.token)).toBe(id)
    expect(entries.map((entry) => [entry.labels.join(' '), entry.message])).toEqual([
      ['Request Auth', 'login.attempt'],
      ['Request Auth', 'login.success'],
    ])
  })

  it('rejects a wrong password and an unknown name, and says which in the log', async () => {
    using testDb = await createTestDb()
    await addUser(testDb, 'alice', 'secret')
    const { ctx, entries } = createTestContext({ testDb })

    expect(await logIn(ctx, 'alice', 'wrong')).toBe(false)
    expect(await logIn(ctx, 'bob', 'secret')).toBe(false)
    expect(getAuth(ctx)).toBeUndefined()
    expect(getCookies(ctx).setCookieHeaders).toEqual([])
    expect(
      entries.filter((entry) => entry.level === 'warn').map((entry) => entry.args.reason),
    ).toEqual(['badPassword', 'unknownUser'])
  })
})

describe('authenticate', () => {
  it('sets getAuth(ctx) from a session cookie', async () => {
    using testDb = await createTestDb()
    const { id } = await addUser(testDb, 'alice', 'secret')
    const { token } = await new AuthTokenStore(testDb.derivedDb).issue(id)

    const { ctx, response } = await authenticated(testDb, `auth=${token}`)
    expect(await response.text()).toBe('page')
    expect(getAuth(ctx)).toMatchObject({ user: { id, name: 'alice' }, token })
    expect(getLogger(ctx).fields.auth).toEqual({ type: 'user', id })
    // a fresh session needs no extending
    expect(getCookies(ctx).setCookieHeaders).toEqual([])
  })

  it('treats visitors without the cookie, and unknown tokens, as signed out', async () => {
    using testDb = await createTestDb()
    const guest = await authenticated(testDb)
    expect(getAuth(guest.ctx)).toBeUndefined()
    expect(getLogger(guest.ctx).fields.auth).toEqual({ type: 'guest' })

    const stranger = await authenticated(testDb, 'auth=not-a-token')
    expect(getAuth(stranger.ctx)).toBeUndefined()
    expect(getLogger(stranger.ctx).fields.auth).toEqual({ type: 'invalidToken' })
  })

  it('extends a session with less than 3 days left', async () => {
    using testDb = await createTestDb()
    const { id } = await addUser(testDb, 'alice', 'secret')
    const { token } = await new AuthTokenStore(testDb.derivedDb).issue(id)
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await testDb.derivedDb
      .update(authtoken)
      .set({ expiresAt: soon })
      .where(eq(authtoken.token, token))

    const { ctx } = await authenticated(testDb, `auth=${token}`)
    expect(getAuth(ctx)!.tokenExpiresAt > soon).toBe(true)
    expect(getCookies(ctx).setCookieHeaders).toEqual([
      `auth=${token}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax`,
    ])
    const stored = await new AuthTokenStore(testDb.derivedDb).getTokenData(token)
    expect(stored?.expiresAt).toBe(getAuth(ctx)!.tokenExpiresAt)
  })
})

describe('manageGate', () => {
  const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']

  // what the gate does with a request: lets it on to the page, or redirects it
  async function gate(testDb: TestDb, path: string, method: string, cookie?: string) {
    const { ctx } = createTestContext({ testDb, url: `http://site.test${path}`, method, cookie })
    await authenticate(ctx, async () => new Response())
    try {
      await manageGate(ctx, async () => new Response('page'))
      return 'page'
    } catch (error) {
      const target = redirectTarget(error)
      if (!target) throw error
      return target.url
    }
  }

  it('sends a request without a session to the login page, whatever its method', async () => {
    using testDb = await createTestDb()
    for (const method of METHODS) {
      expect(await gate(testDb, '/manage/e/post?page=2', method), method).toBe(
        '/manage/login?next=%2Fmanage%2Fe%2Fpost%3Fpage%3D2',
      )
    }
  })

  it('opens the login page and the pages of the links to anyone, for their actions too', async () => {
    using testDb = await createTestDb()
    for (const path of ['/manage/login', '/manage/invite', '/manage/recover']) {
      for (const method of ['GET', 'POST']) {
        expect(await gate(testDb, `${path}?token=x`, method), `${method} ${path}`).toBe('page')
      }
    }
  })

  it('lets a signed-in user in, and sends them from the login page to `next`', async () => {
    using testDb = await createTestDb()
    const { id } = await addUser(testDb, 'alice', 'secret')
    const { token } = await new AuthTokenStore(testDb.derivedDb).issue(id)
    for (const method of METHODS) {
      expect(await gate(testDb, '/manage/e/post', method, `auth=${token}`), method).toBe('page')
    }
    expect(
      await gate(testDb, '/manage/login?next=%2Fmanage%2Fe%2Fpost', 'GET', `auth=${token}`),
    ).toBe('/manage/e/post')
  })

  it("leaves the site's pages alone", async () => {
    using testDb = await createTestDb()
    expect(await gate(testDb, '/en/recipes', 'POST')).toBe('page')
    expect(await gate(testDb, '/managers', 'GET')).toBe('page')
  })
})

describe('logOut', () => {
  it('revokes the session and deletes the cookie', async () => {
    using testDb = await createTestDb()
    const { id } = await addUser(testDb, 'alice', 'secret')
    const { token } = await new AuthTokenStore(testDb.derivedDb).issue(id)
    const { ctx } = await authenticated(testDb, `auth=${token}`)

    await logOut(ctx)
    expect(getAuth(ctx)).toBeUndefined()
    expect(getCookies(ctx).setCookieHeaders).toEqual([
      'auth=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
    ])
    expect(await new AuthTokenStore(testDb.derivedDb).getTokenData(token)).toBeUndefined()
  })
})

describe('setPasswordWithToken', () => {
  const logsIn = async (testDb: TestDb, name: string, password: string) =>
    logIn(createTestContext({ testDb }).ctx, name, password)

  it("creates an invitation's user, and signs in as them", async () => {
    using testDb = await createTestDb()
    const { token } = await new PasswordTokenStore(testDb.derivedDb).issue({
      kind: 'invite',
      userName: 'alice',
    })
    const { ctx, entries } = createTestContext({ testDb })
    expect(await passwordTokenUserName(ctx, 'invite', token)).toBe('alice')
    // the recovery page doesn't take it
    expect(await passwordTokenUserName(ctx, 'recover', token)).toBeUndefined()

    expect(await setPasswordWithToken(ctx, token, 'alices-password')).toBeUndefined()
    const alice = await new UserStore(testDb.db).findByName('alice')
    expect(getAuth(ctx)?.user).toEqual({ id: alice?.id, name: 'alice' })
    expect(getCookies(ctx).setCookieHeaders).toEqual([
      `auth=${getAuth(ctx)?.token}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax`,
    ])
    expect(entries.map((entry) => entry.message)).toContain('invite.accepted')
    expect(await logsIn(testDb, 'alice', 'alices-password')).toBe(true)
    // once
    expect(await passwordTokenUserName(ctx, 'invite', token)).toBeUndefined()
    const again = createTestContext({ testDb }).ctx
    expect(await setPasswordWithToken(again, token, 'another-password')).toBe(LINK_GONE)
  })

  it("sets a recovery link's user's password, and ends their sessions", async () => {
    using testDb = await createTestDb()
    const { id } = await addUser(testDb, 'alice', 'old-password')
    const sessions = new AuthTokenStore(testDb.derivedDb)
    const elsewhere = await sessions.issue(id)
    const { token } = await new PasswordTokenStore(testDb.derivedDb).issue({
      kind: 'recover',
      userId: id,
    })
    const { ctx } = createTestContext({ testDb })
    expect(await passwordTokenUserName(ctx, 'recover', token)).toBe('alice')

    expect(await setPasswordWithToken(ctx, token, 'new-password')).toBeUndefined()
    expect(getAuth(ctx)?.user).toEqual({ id, name: 'alice' })
    expect(await sessions.getTokenData(elsewhere.token)).toBeUndefined()
    expect(await sessions.getUserId(getAuth(ctx)!.token)).toBe(id)
    expect(await logsIn(testDb, 'alice', 'old-password')).toBe(false)
    expect(await logsIn(testDb, 'alice', 'new-password')).toBe(true)
  })

  it("ends the browser's session, which the new one replaces", async () => {
    using testDb = await createTestDb()
    const { id } = await addUser(testDb, 'bob', 'bobs-password')
    const bobs = await new AuthTokenStore(testDb.derivedDb).issue(id)
    const { token } = await new PasswordTokenStore(testDb.derivedDb).issue({
      kind: 'invite',
      userName: 'alice',
    })
    const { ctx } = createTestContext({ testDb, cookie: `auth=${bobs.token}` })

    expect(await setPasswordWithToken(ctx, token, 'alices-password')).toBeUndefined()
    expect(getAuth(ctx)?.user.name).toBe('alice')
    expect(await new AuthTokenStore(testDb.derivedDb).getTokenData(bobs.token)).toBeUndefined()
  })

  it('keeps the link working after a password too short', async () => {
    using testDb = await createTestDb()
    const { token } = await new PasswordTokenStore(testDb.derivedDb).issue({
      kind: 'invite',
      userName: 'alice',
    })
    const { ctx } = createTestContext({ testDb })

    expect(await setPasswordWithToken(ctx, token, 'short')).toBe(
      'The password needs at least 8 characters.',
    )
    expect(getAuth(ctx)).toBeUndefined()
    expect(await passwordTokenUserName(ctx, 'invite', token)).toBe('alice')
  })

  it("turns away a token that isn't one", async () => {
    using testDb = await createTestDb()
    const { ctx } = createTestContext({ testDb })
    expect(await setPasswordWithToken(ctx, 'nope', 'long-enough')).toBe(LINK_GONE)
    expect(getCookies(ctx).setCookieHeaders).toEqual([])
  })
})
