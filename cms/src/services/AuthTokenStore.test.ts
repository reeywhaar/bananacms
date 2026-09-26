import { describe, expect, it } from 'vitest'
import { createTestDb } from '../test/db.ts'
import { AuthTokenStore } from './AuthTokenStore.ts'
import { sha256hex } from './password.ts'

describe('AuthTokenStore', () => {
  it("keeps a session's token as its SHA-256, and finds the session by the token", async () => {
    using testDb = await createTestDb()
    const sessions = new AuthTokenStore(testDb.derivedDb)
    const { token } = await sessions.issue('user-1')

    const { rows } = await testDb.derivedClient.execute('SELECT tokenHash FROM authtoken')
    expect(rows.map((row) => row.tokenHash)).toEqual([sha256hex(token)])
    expect(await sessions.getUserId(token)).toBe('user-1')
    // what the table holds doesn't work as a token
    expect(await sessions.getUserId(sha256hex(token))).toBeUndefined()
  })

  it('extends, counts and revokes sessions by their tokens', async () => {
    using testDb = await createTestDb()
    const sessions = new AuthTokenStore(testDb.derivedDb)
    const first = await sessions.issue('user-1')
    const second = await sessions.issue('user-1')

    expect(await sessions.extend(first.token)).toBe(
      (await sessions.getTokenData(first.token))?.expiresAt,
    )
    expect(await sessions.countOthersForUser('user-1', first.token)).toBe(1)
    expect(await sessions.revokeOthersForUser('user-1', first.token)).toBe(1)
    expect(await sessions.getUserId(second.token)).toBeUndefined()
    await sessions.revoke(first.token)
    expect(await sessions.getUserId(first.token)).toBeUndefined()
  })
})
