import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BlockStore } from './BlockStore'
import { createTestDb, type TestDb } from '../test/db'
import { post, block, parentBlock, localizations, category } from '@cms/lib/db/schema'

const POST_ID = '019dbcea-d3a4-75e7-b37a-190d5165aaaa'
const CATEGORY_ID = '019dbce5-5aac-763a-ac29-509b1a86bbbb'

const TEXT_BLOCK = '019dbcea-d3a4-75e7-b37a-190d51650b01'
const IMAGE_BLOCK = '019dbcea-d3a4-75e7-b37a-190d51650b02'
const GROUP_BLOCK = '019dbcea-d3a4-75e7-b37a-190d51650b03'
const CHILD_BLOCK = '019dbcea-d3a4-75e7-b37a-190d51650b04'

describe('BlockStore.query', () => {
  let testDb: TestDb

  beforeEach(async () => {
    testDb = await createTestDb()
    await testDb.db
      .insert(post)
      .values({
        id: POST_ID,
        shortid: POST_ID.slice(-8),
        name: 'Host Post',
        slug: 'host-post',
        status: 'published',
      })
      .run()
    await insertBlock(testDb, TEXT_BLOCK, 'text', { type: 'text', key: 't1', text: 'Hello' })
    await attach(testDb, TEXT_BLOCK, 'post', POST_ID)
    await insertBlock(testDb, IMAGE_BLOCK, 'image', {
      type: 'image',
      key: 'i1',
      assetId: 'asset-1',
      alt: 'Alt text',
    })
    await attach(testDb, IMAGE_BLOCK, 'post', POST_ID)
  })

  afterEach(async () => {
    testDb.close()
  })

  it('returns blocks attached to a parent post', async () => {
    const blocks = await new BlockStore(testDb.db).query().parentedBy({ table: 'post', id: POST_ID }).all()
    expect(blocks.map((b) => b.id).sort()).toEqual([TEXT_BLOCK, IMAGE_BLOCK].sort())
    const text = blocks.find((b) => b.id === TEXT_BLOCK)!
    expect(text.content).toMatchObject({ type: 'text', text: 'Hello' })
    expect(text.parent).toEqual({ type: 'post', id: POST_ID })
  })

  it('hydrates nested children for group blocks', async () => {
    await insertBlock(testDb, GROUP_BLOCK, 'group', { type: 'group', key: 'g1' })
    await attach(testDb, GROUP_BLOCK, 'post', POST_ID)
    await insertBlock(testDb, CHILD_BLOCK, 'text', { type: 'text', key: 'c1', text: 'Nested' })
    await attach(testDb, CHILD_BLOCK, 'block', GROUP_BLOCK)

    const blocks = await new BlockStore(testDb.db).query().parentedBy({ table: 'post', id: POST_ID }).all()
    const group = blocks.find((b) => b.id === GROUP_BLOCK)!
    expect(group.content.type).toBe('group')
    if (group.content.type !== 'group') throw new Error('unreachable')
    expect(group.content.blocks).toHaveLength(1)
    expect(group.content.blocks.at(0)).toMatchObject({
      id: CHILD_BLOCK,
      content: { type: 'text', text: 'Nested' },
    })
  })

  it('coalesces text-block content via locale', async () => {
    await insertLocalization(testDb, `block:${TEXT_BLOCK}:text`, 'ru', 'Привет')
    const blocks = await new BlockStore(testDb.db)
      .query()
      .parentedBy({ table: 'post', id: POST_ID })
      .locale('ru')
      .all()
    const text = blocks.find((b) => b.id === TEXT_BLOCK)!
    expect(text.content).toMatchObject({ type: 'text', text: 'Привет' })
  })

  it('coalesces image-block alt via locale', async () => {
    await insertLocalization(testDb, `block:${IMAGE_BLOCK}:alt`, 'ru', 'Подпись')
    const blocks = await new BlockStore(testDb.db)
      .query()
      .parentedBy({ table: 'post', id: POST_ID })
      .locale('ru')
      .all()
    const image = blocks.find((b) => b.id === IMAGE_BLOCK)!
    expect(image.content).toMatchObject({ type: 'image', alt: 'Подпись' })
  })

  it('recurses translations through group blocks', async () => {
    await insertBlock(testDb, GROUP_BLOCK, 'group', { type: 'group', key: 'g1' })
    await attach(testDb, GROUP_BLOCK, 'post', POST_ID)
    await insertBlock(testDb, CHILD_BLOCK, 'text', { type: 'text', key: 'c1', text: 'Nested' })
    await attach(testDb, CHILD_BLOCK, 'block', GROUP_BLOCK)
    await insertLocalization(testDb, `block:${CHILD_BLOCK}:text`, 'ru', 'Вложенный')

    const blocks = await new BlockStore(testDb.db)
      .query()
      .parentedBy({ table: 'post', id: POST_ID })
      .locale('ru')
      .all()
    const group = blocks.find((b) => b.id === GROUP_BLOCK)!
    if (group.content.type !== 'group') throw new Error('unreachable')
    expect(group.content.blocks.at(0)?.content).toMatchObject({
      type: 'text',
      text: 'Вложенный',
    })
  })

  it('falls back to source text when no localization exists for that locale', async () => {
    await insertLocalization(testDb, `block:${TEXT_BLOCK}:text`, 'ru', 'Привет')
    const blocks = await new BlockStore(testDb.db)
      .query()
      .parentedBy({ table: 'post', id: POST_ID })
      .locale('en')
      .all()
    const text = blocks.find((b) => b.id === TEXT_BLOCK)!
    expect(text.content).toMatchObject({ type: 'text', text: 'Hello' })
  })

  it('looks up blocks by category shortid', async () => {
    await testDb.db
      .insert(category)
      .values({ id: CATEGORY_ID, shortid: 'cat-shrt', name: 'Cats', slug: 'cats' })
      .run()
    await insertBlock(testDb, '019dbcea-d3a4-75e7-b37a-190d51650b05', 'text', {
      type: 'text',
      key: 't2',
      text: 'On category',
    })
    await attach(testDb, '019dbcea-d3a4-75e7-b37a-190d51650b05', 'category', CATEGORY_ID)

    const blocks = await new BlockStore(testDb.db)
      .query()
      .parentedBy({ table: 'category', shortid: 'cat-shrt' })
      .all()
    expect(blocks.map((b) => b.content)).toEqual([
      expect.objectContaining({ type: 'text', text: 'On category' }),
    ])
  })

  it('all variant returns every block', async () => {
    const blocks = await new BlockStore(testDb.db).query().all()
    expect(blocks.map((b) => b.id).sort()).toEqual([TEXT_BLOCK, IMAGE_BLOCK].sort())
  })

  it('byId fetches a single block', async () => {
    const block = await new BlockStore(testDb.db).query().byId(TEXT_BLOCK).first()
    expect(block?.content).toMatchObject({ type: 'text', text: 'Hello' })
  })

  describe('getPublicByParentIds', () => {
    const POST_2 = '019dbcea-d3a4-75e7-b37a-190d51662222'
    const TEXT_2 = '019dbcea-d3a4-75e7-b37a-190d51650b06'

    beforeEach(async () => {
      await testDb.db.insert(post).values({
        id: POST_2,
        shortid: POST_2.slice(-8),
        name: 'Second',
        slug: 'second',
        status: 'published',
      })
      await insertBlock(testDb, TEXT_2, 'text', { type: 'text', key: 't3', text: 'World' })
      await attach(testDb, TEXT_2, 'post', POST_2)
    })

    it('buckets blocks per parent id in one batched query', async () => {
      const out = await new BlockStore(testDb.db).getPublicByParentIds('en', 'post', [
        POST_ID,
        POST_2,
      ])
      expect(Object.keys(out).sort()).toEqual([POST_ID, POST_2].sort())
      expect(out[POST_ID].map((b) => b.id).sort()).toEqual([TEXT_BLOCK, IMAGE_BLOCK].sort())
      expect(out[POST_2].map((b) => b.id)).toEqual([TEXT_2])
    })

    it('returns empty arrays for parents that have no blocks', async () => {
      const POST_EMPTY = '019dbcea-d3a4-75e7-b37a-190d51663333'
      await testDb.db.insert(post).values({
        id: POST_EMPTY,
        shortid: POST_EMPTY.slice(-8),
        name: 'Empty',
        slug: 'empty',
        status: 'published',
      })
      const out = await new BlockStore(testDb.db).getPublicByParentIds('en', 'post', [POST_EMPTY])
      expect(out[POST_EMPTY]).toEqual([])
    })

    it('returns {} for an empty id list', async () => {
      const out = await new BlockStore(testDb.db).getPublicByParentIds('en', 'post', [])
      expect(out).toEqual({})
    })

    it('applies locale translations per-parent', async () => {
      await insertLocalization(testDb, `block:${TEXT_BLOCK}:text`, 'ru', 'Привет')
      await insertLocalization(testDb, `block:${TEXT_2}:text`, 'ru', 'Мир')
      const out = await new BlockStore(testDb.db).getPublicByParentIds('ru', 'post', [
        POST_ID,
        POST_2,
      ])
      const t1 = out[POST_ID].find((b) => b.id === TEXT_BLOCK)!
      const t2 = out[POST_2].find((b) => b.id === TEXT_2)!
      expect(t1.content).toMatchObject({ type: 'text', text: 'Привет' })
      expect(t2.content).toMatchObject({ type: 'text', text: 'Мир' })
    })
  })

  describe('assets', () => {
    const ASSET_A = '019dbcea-d3a4-75e7-b37a-190d51650a01'
    const ASSET_B = '019dbcea-d3a4-75e7-b37a-190d51650a02'

    beforeEach(async () => {
      const { asset, parentAsset } = await import('@cms/lib/db/schema')
      await testDb.db
        .insert(asset)
        .values({ id: ASSET_A, filename: 'a.png', mime: 'image/png', data: Buffer.from('a') })
      await testDb.db
        .insert(asset)
        .values({ id: ASSET_B, filename: 'b.png', mime: 'image/png', data: Buffer.from('b') })
      await testDb.db
        .insert(parentAsset)
        .values({ assetId: ASSET_A, parentId: IMAGE_BLOCK, parentTable: 'block' })
    })

    it('withAsset() with no args matches blocks with any asset', async () => {
      const blocks = await new BlockStore(testDb.db).query().withAsset().flat().all()
      expect(blocks.map((b) => b.id)).toEqual([IMAGE_BLOCK])
    })

    it('withAsset({ id }) matches blocks referencing the specific asset', async () => {
      const blocks = await new BlockStore(testDb.db)
        .query()
        .withAsset({ id: ASSET_A })
        .flat()
        .all()
      expect(blocks.map((b) => b.id)).toEqual([IMAGE_BLOCK])
    })

    it('withoutAsset({ id }) excludes blocks referencing that asset', async () => {
      const blocks = await new BlockStore(testDb.db)
        .query()
        .withoutAsset({ id: ASSET_A })
        .flat()
        .all()
      expect(blocks.map((b) => b.id).sort()).toEqual([TEXT_BLOCK].sort())
    })
  })
})

async function insertBlock(
  testDb: TestDb,
  id: string,
  type: string,
  content: object,
): Promise<void> {
  await testDb.db.insert(block).values({ id, type, content: JSON.stringify(content) })
}

async function attach(
  testDb: TestDb,
  blockId: string,
  parentTable: string,
  parentId: string,
): Promise<void> {
  await testDb.db.insert(parentBlock).values({ blockId, parentId, parentTable })
}

async function insertLocalization(
  testDb: TestDb,
  key: string,
  locale: string,
  text: string,
): Promise<void> {
  await testDb.db.insert(localizations).values({ id: `loc-${key}-${locale}`, key, locale, text })
}
