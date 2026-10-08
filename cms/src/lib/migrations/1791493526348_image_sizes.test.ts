import sharp from 'sharp'
import { expect, it } from 'vitest'
import { createTestDb, type TestDb } from '#cms/test/db.ts'
import migration from './1791493526348_image_sizes.ts'

// runs the migration up, as the migrations table does, in a transaction
async function up(testDb: TestDb) {
  const tx = await testDb.client.transaction('write')
  await migration.up(tx, testDb.derivedClient)
  await tx.commit()
}

const image = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#fc0' } })

async function addAsset(
  testDb: TestDb,
  id: string,
  mime: string,
  content: string | null,
  data: Buffer,
) {
  await testDb.client.execute({
    sql: 'INSERT INTO asset (id, filename, mime, content) VALUES (?, ?, ?, ?)',
    args: [id, id, mime, content],
  })
  await testDb.client.execute({
    sql: 'INSERT INTO asset_blob (id, data) VALUES (?, ?)',
    args: [id, data],
  })
}

const contentOf = async (testDb: TestDb, id: string) => {
  const { rows } = await testDb.client.execute({
    sql: 'SELECT content FROM asset WHERE id = ?',
    args: [id],
  })
  return rows[0].content === null ? null : JSON.parse(String(rows[0].content))
}

it('stores the size of the images without one, from their files', async () => {
  using testDb = await createTestDb()
  await addAsset(testDb, 'bare', 'image/png', null, await image(3, 2).png().toBuffer())
  await addAsset(
    testDb,
    'old',
    'image/jpeg',
    '{"resolution":"@2x"}',
    await image(4, 6).jpeg().toBuffer(),
  )
  // a photo stored on its side, which shows turned as its EXIF says
  await addAsset(
    testDb,
    'turned',
    'image/jpeg',
    null,
    await image(4, 6).jpeg().withMetadata({ orientation: 6 }).toBuffer(),
  )

  await up(testDb)

  expect(await contentOf(testDb, 'bare')).toEqual({ width: 3, height: 2 })
  expect(await contentOf(testDb, 'old')).toEqual({ resolution: '@2x', width: 4, height: 6 })
  expect(await contentOf(testDb, 'turned')).toEqual({ width: 6, height: 4 })
})

it('leaves alone an image with a size, one sharp cannot read, and what is not an image', async () => {
  using testDb = await createTestDb()
  const png = await image(3, 2).png().toBuffer()
  const measured = '{"type":"image","width":10,"height":10}'
  await addAsset(testDb, 'measured', 'image/png', measured, png)
  await addAsset(testDb, 'broken', 'image/png', null, Buffer.from('not an image'))
  await addAsset(testDb, 'file', 'image/png', '{"type":"file"}', png)
  await addAsset(testDb, 'pdf', 'application/pdf', null, png)

  await up(testDb)

  expect(await contentOf(testDb, 'measured')).toEqual(JSON.parse(measured))
  expect(await contentOf(testDb, 'broken')).toBeNull()
  expect(await contentOf(testDb, 'file')).toEqual({ type: 'file' })
  expect(await contentOf(testDb, 'pdf')).toBeNull()
})
