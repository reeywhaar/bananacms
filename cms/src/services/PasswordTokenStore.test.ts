import { describe, expect, it } from 'vitest'
import { passwordToken } from '../lib/db/derivedSchema.ts'
import { createTestDb } from '../test/db.ts'
import { sha256hex } from './password.ts'
import { PasswordTokenStore } from './PasswordTokenStore.ts'

describe('PasswordTokenStore', () => {
  it('says whom a token is for, until it is used up', async () => {
    using testDb = await createTestDb()
    const tokens = new PasswordTokenStore(testDb.derivedDb)
    const { token } = await tokens.issue({ kind: 'invite', userName: 'alice' })

    expect(await tokens.find(token)).toEqual({ kind: 'invite', userName: 'alice' })
    expect(await tokens.consume(token)).toEqual({ kind: 'invite', userName: 'alice' })
    expect(await tokens.find(token)).toBeUndefined()
    expect(await tokens.consume(token)).toBeUndefined()
  })

  it("keeps the token's hash, not the token", async () => {
    using testDb = await createTestDb()
    const { token } = await new PasswordTokenStore(testDb.derivedDb).issue({
      kind: 'recover',
      userId: 'u1',
    })
    const rows = await testDb.derivedDb.select().from(passwordToken).all()
    expect(rows).toMatchObject([
      { kind: 'recover', userId: 'u1', userName: null, tokenHash: sha256hex(token) },
    ])
    expect(JSON.stringify(rows)).not.toContain(token)
  })

  it('gives an invitation 7 days, and a recovery link 24 hours', async () => {
    using testDb = await createTestDb()
    const tokens = new PasswordTokenStore(testDb.derivedDb)
    const hoursLeft = ({ expiresAt }: { expiresAt: string }) =>
      Math.round((new Date(expiresAt).getTime() - Date.now()) / (60 * 60 * 1000))
    expect(hoursLeft(await tokens.issue({ kind: 'invite', userName: 'alice' }))).toBe(7 * 24)
    expect(hoursLeft(await tokens.issue({ kind: 'recover', userId: 'u1' }))).toBe(24)
  })

  it('replaces the tokens issued for the same user before', async () => {
    using testDb = await createTestDb()
    const tokens = new PasswordTokenStore(testDb.derivedDb)
    const first = await tokens.issue({ kind: 'invite', userName: 'alice' })
    const bob = await tokens.issue({ kind: 'invite', userName: 'bob' })
    const second = await tokens.issue({ kind: 'invite', userName: 'alice' })

    expect([first.replaced, bob.replaced, second.replaced]).toEqual([0, 0, 1])
    expect(await tokens.find(first.token)).toBeUndefined()
    expect(await tokens.find(second.token)).toEqual({ kind: 'invite', userName: 'alice' })
    expect(await tokens.find(bob.token)).toEqual({ kind: 'invite', userName: 'bob' })
  })

  it('turns away an expired token, which the next one issued deletes', async () => {
    using testDb = await createTestDb()
    const tokens = new PasswordTokenStore(testDb.derivedDb)
    const { token } = await tokens.issue({ kind: 'recover', userId: 'u1' })
    await testDb.derivedDb
      .update(passwordToken)
      .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })

    expect(await tokens.find(token)).toBeUndefined()
    expect(await tokens.consume(token)).toBeUndefined()
    await tokens.issue({ kind: 'invite', userName: 'bob' })
    expect(await testDb.derivedDb.select().from(passwordToken).all()).toMatchObject([
      { userName: 'bob' },
    ])
  })
})
