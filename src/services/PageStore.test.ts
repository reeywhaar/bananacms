import { describe, it, expect } from 'vitest'
import { PageStore } from './PageStore'
import { createTestDb, type TestDb } from '../test/db'
import { page } from '@cms/lib/db/schema'

const PAGE_A = '019dbce5-0000-7000-0001-000000000001'
const PAGE_B = '019dbce5-0000-7000-0001-000000000002'
const PAGE_C = '019dbce5-0000-7000-0001-000000000003'

describe('PageStore.query', () => {
  describe('indexOf', () => {
    it('returns 0 for the first page in key order', async () => {
      using testDb = await createTestDb()
      await seedPages(testDb)
      // key asc default: about(0), contact(1), home(2)
      const idx = await new PageStore(testDb.db).query().indexOf((q) => q.byKey('about'))
      expect(idx).toBe(0)
    })

    it('returns 1 for the second page', async () => {
      using testDb = await createTestDb()
      await seedPages(testDb)
      const idx = await new PageStore(testDb.db).query().indexOf((q) => q.byKey('contact'))
      expect(idx).toBe(1)
    })

    it('returns 2 for the last page', async () => {
      using testDb = await createTestDb()
      await seedPages(testDb)
      const idx = await new PageStore(testDb.db).query().indexOf((q) => q.byKey('home'))
      expect(idx).toBe(2)
    })

    it('returns -1 when anchor does not exist', async () => {
      using testDb = await createTestDb()
      await seedPages(testDb)
      const idx = await new PageStore(testDb.db).query().indexOf((q) => q.byKey('no-such'))
      expect(idx).toBe(-1)
    })

    it('works with orderBy key desc', async () => {
      using testDb = await createTestDb()
      await seedPages(testDb)
      // key desc: home(0), contact(1), about(2)
      const idx = await new PageStore(testDb.db)
        .query()
        .orderBy('key', 'desc')
        .indexOf((q) => q.byKey('about'))
      expect(idx).toBe(2)
    })
  })
})

// ─── seed fixtures ───────────────────────────────────────────────────────────

async function seedPages(testDb: TestDb): Promise<void> {
  await testDb.db.insert(page).values({ id: PAGE_A, key: 'about' })
  await testDb.db.insert(page).values({ id: PAGE_B, key: 'contact' })
  await testDb.db.insert(page).values({ id: PAGE_C, key: 'home' })
}
