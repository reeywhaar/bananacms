import { expect, it } from 'vitest'
import { createTestDb, type TestDb } from '#cms/test/db.ts'
import migration from './1793322530438_drop_block_name.ts'

// runs the migration down or up, as the migrations table does, in a transaction
async function run(testDb: TestDb, direction: 'up' | 'down') {
  const tx = await testDb.client.transaction('write')
  await migration[direction](tx, testDb.derivedClient)
  await tx.commit()
}

async function addBlock(testDb: TestDb, id: string, content: object) {
  await testDb.client.execute({
    sql: 'INSERT INTO block (id, content) VALUES (?, ?)',
    args: [id, JSON.stringify(content)],
  })
}

const contentOf = async (testDb: TestDb, id: string) => {
  const { rows } = await testDb.client.execute({
    sql: 'SELECT content FROM block WHERE id = ?',
    args: [id],
  })
  return JSON.parse(String(rows[0].content))
}

it("drops an image or a file block's name, and leaves other blocks be", async () => {
  using testDb = await createTestDb()
  const image = { type: 'image', key: 'still', name: 'a.jpg', alt: 'A train', assetId: 'a1' }
  const file = { type: 'asset', key: 'card', name: 'Recipe card (PDF)', assetId: 'a2' }
  const text = { type: 'text', key: 'name', contentType: 'plain', text: 'Hi' }
  await addBlock(testDb, 'image', image)
  await addBlock(testDb, 'file', file)
  await addBlock(testDb, 'text', text)

  await run(testDb, 'up')

  expect(await contentOf(testDb, 'image')).toEqual({
    type: 'image',
    key: 'still',
    alt: 'A train',
    assetId: 'a1',
  })
  expect(await contentOf(testDb, 'file')).toEqual({ type: 'asset', key: 'card', assetId: 'a2' })
  expect(await contentOf(testDb, 'text')).toEqual(text)
})

it("gives a block its asset's filename as its name going down", async () => {
  using testDb = await createTestDb()
  await testDb.client.execute(
    "INSERT INTO asset (id, filename, mime) VALUES ('a1', 'train.jpg', 'image/jpeg')",
  )
  await addBlock(testDb, 'image', { type: 'image', key: 'still', alt: '', assetId: 'a1' })
  await addBlock(testDb, 'gone', { type: 'asset', key: 'card', assetId: 'missing' })

  await run(testDb, 'down')

  expect((await contentOf(testDb, 'image')).name).toBe('train.jpg')
  expect((await contentOf(testDb, 'gone')).name).toBe('')
})
