import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@libsql/client'
import { describe, expect, it } from 'vitest'
import { asset, block, category, post } from '@cms/lib/db/schema'
import { createTestDb, type TestDb } from '../../test/db'
import { dumpDatabase, hashDump } from './dump'

const BLOCK_CONTENT = "line1\nline2 'quoted' with a literal \\n sequence\r\nand a tab\t."
const BLOB_DATA = Buffer.from(Array.from({ length: 256 }, (_, i) => i))

const POSTS = [
  {
    id: 'post-1',
    shortid: 'p1',
    name: 'First',
    slug: 'first',
    createdAt: '2026-01-01 00:00:00',
    updatedAt: '2026-01-01 00:00:00',
    status: 'published' as const,
  },
  {
    id: 'post-2',
    shortid: 'p2',
    name: 'Second',
    slug: 'second',
    createdAt: '2026-01-02 00:00:00',
    updatedAt: '2026-01-02 00:00:00',
    status: 'draft' as const,
  },
]

async function seed(testDb: TestDb, reverseOrder = false) {
  await testDb.db
    .insert(category)
    .values({ id: 'cat-1', name: "Quo'ted", slug: 'quoted', shortid: 'c1' })
  await testDb.db.insert(post).values(reverseOrder ? [...POSTS].reverse() : POSTS)
  await testDb.db.insert(block).values({ id: 'block-1', content: BLOCK_CONTENT })
  await testDb.db.insert(asset).values({
    id: 'asset-1',
    filename: 'a.bin',
    mime: 'application/octet-stream',
    data: BLOB_DATA,
    createdAt: 123,
    content: null,
  })
  await testDb.client.execute(
    "INSERT INTO post_fts (postId, locale, content) VALUES ('post-1', 'en', 'hello fts world')",
  )
}

describe('dumpDatabase', () => {
  it('is deterministic regardless of insertion order', async () => {
    using a = await createTestDb()
    using b = await createTestDb()
    await seed(a)
    await seed(b, true)
    const dumpA = await dumpDatabase(a.client)
    const dumpB = await dumpDatabase(b.client)
    expect(dumpA).toBe(dumpB)
    expect(hashDump(dumpA)).toBe(hashDump(dumpB))
    expect(await dumpDatabase(a.client)).toBe(dumpA)
  })

  it('roundtrips through executeMultiple byte-identically', async () => {
    using testDb = await createTestDb()
    await seed(testDb)
    const dump = await dumpDatabase(testDb.client)

    const dir = mkdtempSync(join(tmpdir(), 'bananacms-dump-'))
    const restored = createClient({ url: `file:${join(dir, 'restored.db')}` })
    try {
      await restored.executeMultiple(dump)
      expect(await dumpDatabase(restored)).toBe(dump)

      const blockRow = await restored.execute("SELECT content FROM block WHERE id = 'block-1'")
      expect(blockRow.rows[0].content).toBe(BLOCK_CONTENT)

      const assetRow = await restored.execute("SELECT data FROM asset WHERE id = 'asset-1'")
      expect(Buffer.from(assetRow.rows[0].data as ArrayBuffer)).toEqual(BLOB_DATA)

      const fts = await restored.execute("SELECT postId FROM post_fts WHERE post_fts MATCH 'hello'")
      expect(fts.rows.map((r) => r.postId)).toEqual(['post-1'])
    } finally {
      restored.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('dumps the fts table but not its shadow tables', async () => {
    using testDb = await createTestDb()
    await seed(testDb)
    const dump = await dumpDatabase(testDb.client)
    expect(dump).toContain('CREATE VIRTUAL TABLE post_fts')
    expect(dump).toContain('INSERT INTO "post_fts"')
    expect(dump).not.toContain('post_fts_data')
    expect(dump).not.toContain('post_fts_idx')
  })

  it('includes the migrations bookkeeping table', async () => {
    using testDb = await createTestDb()
    const dump = await dumpDatabase(testDb.client)
    // sqlite_master stores the statement with IF NOT EXISTS stripped.
    expect(dump).toContain('CREATE TABLE migrations')
    expect(dump).toContain('INSERT INTO "migrations"')
  })

  it('emits one line per row', async () => {
    using testDb = await createTestDb()
    await seed(testDb)
    const dump = await dumpDatabase(testDb.client)
    const insertLines = dump.split('\n').filter((l) => l.startsWith('INSERT INTO "block"'))
    expect(insertLines).toHaveLength(1)
  })
})
