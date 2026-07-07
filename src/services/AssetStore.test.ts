import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@libsql/client'
import { describe, expect, it } from 'vitest'
import { AssetStore, type AssetImageContent } from './AssetStore'
import { createTestDb } from '../test/db'
import { asset, assetBlob } from '@cms/lib/db/schema'
import assetBlobMigration from '../lib/migrations/017834727000_asset_blob.ts'

const ID_A = '019dbcea-d3a4-75e7-b37a-190d51650a01'
const ID_B = '019dbcea-d3a4-75e7-b37a-190d51650a02'

const CONTENT: AssetImageContent = { type: 'image', width: 640, height: 480 }

describe('AssetStore', () => {
  it('round-trips an asset through add/get/getMeta/getData', async () => {
    using testDb = await createTestDb()
    const store = new AssetStore(testDb.db)
    const data = Buffer.from('jpeg-bytes')
    await store.add(ID_A, { filename: 'a.jpg', mime: 'image/jpeg', data, content: CONTENT })

    const full = await store.get(ID_A)
    expect(full).toMatchObject({ id: ID_A, filename: 'a.jpg', mime: 'image/jpeg' })
    expect(full?.data).toEqual(data)
    expect(full?.content).toEqual(CONTENT)

    const meta = await store.getMeta(ID_A)
    expect(meta).toMatchObject({ id: ID_A, filename: 'a.jpg', size: data.length })
    expect(meta?.content).toEqual(CONTENT)

    expect(await store.getData(ID_A)).toEqual(data)
  })

  it('returns content and sizes for many ids without the blob', async () => {
    using testDb = await createTestDb()
    const store = new AssetStore(testDb.db)
    await store.add(ID_A, {
      filename: 'a.jpg',
      mime: 'image/jpeg',
      data: Buffer.from('aa'),
      content: CONTENT,
    })
    await store.add(ID_B, { filename: 'b.bin', mime: 'application/pdf', data: Buffer.from('bbb') })

    expect(await store.getContent([ID_A, ID_B])).toEqual({ [ID_A]: CONTENT })
    expect(await store.getSizes([ID_A, ID_B])).toEqual({ [ID_A]: 2, [ID_B]: 3 })
  })

  it('deletes both the asset row and its blob', async () => {
    using testDb = await createTestDb()
    const store = new AssetStore(testDb.db)
    await store.add(ID_A, { filename: 'a.jpg', mime: 'image/jpeg', data: Buffer.from('a') })
    await store.delete(ID_A)

    expect(await store.get(ID_A)).toBeNull()
    expect(await testDb.db.select({ id: asset.id }).from(asset)).toEqual([])
    expect(await testDb.db.select({ id: assetBlob.id }).from(assetBlob)).toEqual([])
  })

  it('updateContent merges patches without touching the blob', async () => {
    using testDb = await createTestDb()
    const store = new AssetStore(testDb.db)
    await store.add(ID_A, {
      filename: 'a.jpg',
      mime: 'image/jpeg',
      data: Buffer.from('a'),
      content: CONTENT,
    })
    await store.updateContent(ID_A, { resolution: '@2x', height: null })

    const meta = await store.getMeta(ID_A)
    expect(meta?.content).toEqual({ type: 'image', width: 640, resolution: '@2x' })
    expect(await store.getData(ID_A)).toEqual(Buffer.from('a'))
  })

  it('asset_blob migration backfills legacy rows and drops the inline column', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bananacms-assetblob-'))
    const client = createClient({ url: `file:${join(dir, 'db.sqlite')}` })
    try {
      // The pre-migration shape: blob inline, before content.
      await client.executeMultiple(`
        CREATE TABLE asset (
          id        TEXT    PRIMARY KEY,
          filename  TEXT    NOT NULL,
          mime      TEXT    NOT NULL,
          data      BLOB    NOT NULL,
          createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
          content   TEXT
        );
        INSERT INTO asset (id, filename, mime, data, content)
          VALUES ('a1', 'a.jpg', 'image/jpeg', x'deadbeef', '{"type":"image"}');
      `)

      const tx = await client.transaction('write')
      try {
        await assetBlobMigration.up(tx, client)
        await tx.commit()
      } finally {
        tx.close()
      }

      const columns = await client.execute('PRAGMA table_info(asset)')
      expect(columns.rows.map((r) => r.name)).not.toContain('data')
      const blob = await client.execute("SELECT data FROM asset_blob WHERE id = 'a1'")
      expect(Buffer.from(blob.rows[0].data as ArrayBuffer)).toEqual(Buffer.from('deadbeef', 'hex'))
      const row = await client.execute("SELECT content FROM asset WHERE id = 'a1'")
      expect(row.rows[0].content).toBe('{"type":"image"}')
    } finally {
      client.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
