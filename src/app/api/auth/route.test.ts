import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, type NextResponse } from 'next/server'
import { Database } from 'sqlite'
import { createTestDb } from '@cms/test/db'
import { hashPassword } from '@cms/services/password'
import { AuthTokenStore } from '@cms/services/AuthTokenStore'

let testDb: Database

vi.mock('@cms/services/getServices', () => {
  const stubLogger: {
    child: () => typeof stubLogger
    info: () => void
    warn: () => void
    error: () => void
    setContext: () => void
  } = {
    child: () => stubLogger,
    info: () => {},
    warn: () => {},
    error: () => {},
    setContext: () => {},
  }
  return {
    getServices: async () => ({ db: testDb, rootLogger: stubLogger }),
  }
})

const { POST, DELETE } = await import('./route')

const USER_ID = '019dc719-ac2c-74bb-957e-d4afd10e7d1a'
const USERNAME = 'demo'
const CLIENT_HASH = 'fake-sha256-of-password'

async function seedUser(): Promise<void> {
  const stored = await hashPassword(CLIENT_HASH)
  await testDb.run(
    'INSERT INTO user (id, name, password_hash) VALUES (?, ?, ?)',
    USER_ID,
    USERNAME,
    stored,
  )
}

function buildPostRequest(body: unknown): NextRequest {
  return new NextRequest('http://test/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function buildDeleteRequest(cookieToken?: string): NextRequest {
  return new NextRequest('http://test/api/auth', {
    method: 'DELETE',
    headers: cookieToken ? { cookie: `auth=${cookieToken}` } : {},
  })
}

describe('POST /api/auth', () => {
  beforeEach(async () => {
    testDb = await createTestDb()
  })

  afterEach(async () => {
    await testDb.close()
  })

  it('returns 204 and sets an auth cookie on valid credentials', async () => {
    await seedUser()
    const res = (await POST(
      buildPostRequest({ username: USERNAME, hash: CLIENT_HASH }),
      undefined,
    )) as NextResponse

    expect(res.status).toBe(204)
    const cookie = res.cookies.get('auth')
    expect(cookie?.value).toBeTruthy()
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe('strict')
    expect(cookie?.path).toBe('/')

    const userId = await new AuthTokenStore(testDb).getUserId(cookie!.value)
    expect(userId).toBe(USER_ID)
  })

  it('returns 401 on bad password', async () => {
    await seedUser()
    const res = (await POST(
      buildPostRequest({ username: USERNAME, hash: 'wrong-hash' }),
      undefined,
    )) as NextResponse

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'Unauthorized' })
    expect(res.cookies.get('auth')).toBeUndefined()
  })

  it('returns 401 on unknown user (timing-safe via dummy hash)', async () => {
    const res = (await POST(
      buildPostRequest({ username: 'ghost', hash: 'whatever' }),
      undefined,
    )) as NextResponse
    expect(res.status).toBe(401)
    expect(res.cookies.get('auth')).toBeUndefined()
  })

  it('returns 400 on malformed JSON', async () => {
    const res = await POST(buildPostRequest('not-json{'), undefined)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid JSON' })
  })

  it('returns 400 when fields are missing', async () => {
    const res = await POST(buildPostRequest({ username: USERNAME }), undefined)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid credentials payload' })
  })

  it('issues a fresh token on each successful login', async () => {
    await seedUser()
    const r1 = (await POST(
      buildPostRequest({ username: USERNAME, hash: CLIENT_HASH }),
      undefined,
    )) as NextResponse
    const r2 = (await POST(
      buildPostRequest({ username: USERNAME, hash: CLIENT_HASH }),
      undefined,
    )) as NextResponse
    const t1 = r1.cookies.get('auth')?.value
    const t2 = r2.cookies.get('auth')?.value
    expect(t1).toBeTruthy()
    expect(t2).toBeTruthy()
    expect(t1).not.toBe(t2)
  })
})

describe('DELETE /api/auth', () => {
  beforeEach(async () => {
    testDb = await createTestDb()
  })

  afterEach(async () => {
    await testDb.close()
  })

  it('revokes the token from the auth cookie and clears the cookie', async () => {
    await seedUser()
    const tokenStore = new AuthTokenStore(testDb)
    const { token } = await tokenStore.issue(USER_ID)

    const res = (await DELETE(buildDeleteRequest(token), undefined)) as NextResponse

    expect(res.status).toBe(204)
    const cleared = res.cookies.get('auth')
    expect(cleared?.value).toBe('')
    expect(await tokenStore.getUserId(token)).toBeUndefined()
  })

  it('is idempotent when no auth cookie is present', async () => {
    const res = await DELETE(buildDeleteRequest(), undefined)
    expect(res.status).toBe(204)
  })

  it('still clears the cookie when the token is unknown', async () => {
    const res = (await DELETE(
      buildDeleteRequest('not-a-real-token'),
      undefined,
    )) as NextResponse
    expect(res.status).toBe(204)
    expect(res.cookies.get('auth')?.value).toBe('')
  })
})
