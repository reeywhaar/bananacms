import { expect, it } from 'vitest'
import { AuthTokenStore } from '#cms/services/AuthTokenStore.ts'
import { sha256hex } from '#cms/services/password.ts'
import { createTestDb, type TestDb } from '#cms/test/db.ts'
import migration from './1790450351289_derived_authtoken_hash.ts'

const inAWeek = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

// runs the migration down or up, as the migrations table does, in a transaction
async function run(testDb: TestDb, direction: 'up' | 'down') {
  const tx = await testDb.client.transaction('write')
  await migration[direction](tx, testDb.derivedClient)
  await tx.commit()
}

it('hashes the tokens already there, so their sessions carry on', async () => {
  using testDb = await createTestDb()
  await run(testDb, 'down')
  await testDb.derivedClient.execute({
    sql: 'INSERT INTO authtoken (token, userId, expiresAt) VALUES (?, ?, ?)',
    args: ['a-token', 'user-1', inAWeek()],
  })

  await run(testDb, 'up')
  const { rows } = await testDb.derivedClient.execute('SELECT tokenHash FROM authtoken')
  expect(rows.map((row) => row.tokenHash)).toEqual([sha256hex('a-token')])
  expect(await new AuthTokenStore(testDb.derivedDb).getUserId('a-token')).toBe('user-1')
})

it('ends the sessions going down, as a hash gives no token back', async () => {
  using testDb = await createTestDb()
  await new AuthTokenStore(testDb.derivedDb).issue('user-1')
  await run(testDb, 'down')
  const { rows } = await testDb.derivedClient.execute('SELECT * FROM authtoken')
  expect(rows).toEqual([])
  const columns = await testDb.derivedClient.execute('PRAGMA table_info(authtoken)')
  expect(columns.rows.map((column) => column.name)).toEqual(['id', 'token', 'userId', 'expiresAt'])
})
