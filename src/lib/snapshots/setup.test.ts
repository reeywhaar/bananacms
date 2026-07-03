import { describe, expect, it, vi } from 'vitest'
import { category } from '@cms/lib/db/schema'
import { createTestDb } from '../../test/db'
import { wrapDbWithWriteHook } from './setup'

describe('wrapDbWithWriteHook', () => {
  it('fires onWrite for writes but not reads, without breaking drizzle', async () => {
    using testDb = await createTestDb()
    const onWrite = vi.fn()
    const db = wrapDbWithWriteHook(testDb.db, onWrite)

    await db.select().from(category)
    await db.query.category.findMany()
    expect(onWrite).not.toHaveBeenCalled()

    await db.insert(category).values({ id: 'cat-1', name: 'Cat', slug: 'cat', shortid: 'c1' })
    expect(onWrite).toHaveBeenCalled()

    const rows = await db.select().from(category)
    expect(rows.map((r) => r.id)).toEqual(['cat-1'])

    onWrite.mockClear()
    await db.delete(category)
    expect(onWrite).toHaveBeenCalled()
    expect(await db.select().from(category)).toHaveLength(0)
  })

  it('marks transactions dirty and they still work', async () => {
    using testDb = await createTestDb()
    const onWrite = vi.fn()
    const db = wrapDbWithWriteHook(testDb.db, onWrite)

    await db.transaction(async (tx) => {
      await tx.insert(category).values({ id: 'cat-2', name: 'Tx', slug: 'tx', shortid: 'c2' })
    })
    expect(onWrite).toHaveBeenCalled()
    expect(await db.select().from(category)).toHaveLength(1)
  })
})
