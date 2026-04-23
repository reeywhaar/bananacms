import { describe, it, expect } from 'vitest'
import { CategoryStore } from './CategoryStore'
import { createTestDb, type TestDb } from '../test/db'
import { category } from '@cms/lib/db/schema'

const CAT_A = '019dbce5-0000-7000-0000-000000000001'
const CAT_B = '019dbce5-0000-7000-0000-000000000002'
const CAT_C = '019dbce5-0000-7000-0000-000000000003'

describe('CategoryStore.query', () => {
  describe('indexOf', () => {
    it('returns 0 for the first category in name order', async () => {
      using testDb = await createTestDb()
      await seedCategories(testDb)
      // name asc: Apple(0), Banana(1), Cherry(2)
      const idx = await new CategoryStore(testDb.db)
        .query()
        .orderBy('name')
        .indexOf((q) => q.byShortId(CAT_A.slice(-8)))
      expect(idx).toBe(0)
    })

    it('returns 1 for the second category', async () => {
      using testDb = await createTestDb()
      await seedCategories(testDb)
      const idx = await new CategoryStore(testDb.db)
        .query()
        .orderBy('name')
        .indexOf((q) => q.byShortId(CAT_B.slice(-8)))
      expect(idx).toBe(1)
    })

    it('returns 2 for the last category', async () => {
      using testDb = await createTestDb()
      await seedCategories(testDb)
      const idx = await new CategoryStore(testDb.db)
        .query()
        .orderBy('name')
        .indexOf((q) => q.byShortId(CAT_C.slice(-8)))
      expect(idx).toBe(2)
    })

    it('returns -1 when anchor does not exist', async () => {
      using testDb = await createTestDb()
      await seedCategories(testDb)
      const idx = await new CategoryStore(testDb.db).query().indexOf((q) => q.byShortId('no-such'))
      expect(idx).toBe(-1)
    })

    it('works with orderBy name desc', async () => {
      using testDb = await createTestDb()
      await seedCategories(testDb)
      // name desc: Cherry(0), Banana(1), Apple(2)
      const idx = await new CategoryStore(testDb.db)
        .query()
        .orderBy('name', 'desc')
        .indexOf((q) => q.byShortId(CAT_A.slice(-8)))
      expect(idx).toBe(2)
    })

    it('works with bySlug as anchor', async () => {
      using testDb = await createTestDb()
      await seedCategories(testDb)
      const idx = await new CategoryStore(testDb.db)
        .query()
        .orderBy('name')
        .indexOf((q) => q.bySlug('banana'))
      expect(idx).toBe(1)
    })
  })
})

// ─── seed fixtures ───────────────────────────────────────────────────────────

async function seedCategories(testDb: TestDb): Promise<void> {
  await testDb.db
    .insert(category)
    .values({ id: CAT_A, shortid: CAT_A.slice(-8), name: 'Apple', slug: 'apple' })
  await testDb.db
    .insert(category)
    .values({ id: CAT_B, shortid: CAT_B.slice(-8), name: 'Banana', slug: 'banana' })
  await testDb.db
    .insert(category)
    .values({ id: CAT_C, shortid: CAT_C.slice(-8), name: 'Cherry', slug: 'cherry' })
}
