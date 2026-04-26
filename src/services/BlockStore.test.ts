import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Database } from 'sqlite'
import { BlockStore } from './BlockStore'
import { InvalidIdentifierError } from './getByParentQuery'
import { createTestDb } from '../test/db'

const POST_ID = '019dbcea-d3a4-75e7-b37a-190d5165aaaa'
const CATEGORY_ID = '019dbce5-5aac-763a-ac29-509b1a86bbbb'

const TEXT_BLOCK = '019dbcea-d3a4-75e7-b37a-190d51650b01'
const IMAGE_BLOCK = '019dbcea-d3a4-75e7-b37a-190d51650b02'
const GROUP_BLOCK = '019dbcea-d3a4-75e7-b37a-190d51650b03'
const CHILD_BLOCK = '019dbcea-d3a4-75e7-b37a-190d51650b04'

describe('BlockStore.getByParent', () => {
  let db: Database

  beforeEach(async () => {
    db = await createTestDb()
    await db.run(
      'INSERT INTO post (id, shortid, name, slug, status) VALUES (?, ?, ?, ?, ?)',
      POST_ID,
      POST_ID.slice(-8),
      'Host Post',
      'host-post',
      'published',
    )
    await insertBlock(db, TEXT_BLOCK, 'text', { type: 'text', key: 't1', text: 'Hello' })
    await attach(db, TEXT_BLOCK, 'post', POST_ID)
    await insertBlock(db, IMAGE_BLOCK, 'image', {
      type: 'image',
      key: 'i1',
      assetId: 'asset-1',
      alt: 'Alt text',
    })
    await attach(db, IMAGE_BLOCK, 'post', POST_ID)
  })

  afterEach(async () => {
    await db.close()
  })

  const onPost = { table: 'post', column: 'id', value: POST_ID } as const

  it('returns blocks attached to a parent post', async () => {
    const blocks = await new BlockStore(db).getByParent(onPost)
    expect(blocks.map((b) => b.id).sort()).toEqual([TEXT_BLOCK, IMAGE_BLOCK].sort())
    const text = blocks.find((b) => b.id === TEXT_BLOCK)!
    expect(text.content).toMatchObject({ type: 'text', text: 'Hello' })
    expect(text.parent).toEqual({ type: 'post', id: POST_ID })
  })

  it('hydrates nested children for group blocks', async () => {
    await insertBlock(db, GROUP_BLOCK, 'group', { type: 'group', key: 'g1' })
    await attach(db, GROUP_BLOCK, 'post', POST_ID)
    await insertBlock(db, CHILD_BLOCK, 'text', { type: 'text', key: 'c1', text: 'Nested' })
    await attach(db, CHILD_BLOCK, 'block', GROUP_BLOCK)

    const blocks = await new BlockStore(db).getByParent(onPost)
    const group = blocks.find((b) => b.id === GROUP_BLOCK)!
    expect(group.content.type).toBe('group')
    if (group.content.type !== 'group') throw new Error('unreachable')
    expect(group.content.blocks).toHaveLength(1)
    expect(group.content.blocks[0]).toMatchObject({
      id: CHILD_BLOCK,
      content: { type: 'text', text: 'Nested' },
    })
  })

  it('coalesces text-block content via locale', async () => {
    await insertLocalization(db, `block:${TEXT_BLOCK}:text`, 'ru', 'Привет')
    const blocks = await new BlockStore(db).getByParent(onPost, { locale: 'ru' })
    const text = blocks.find((b) => b.id === TEXT_BLOCK)!
    expect(text.content).toMatchObject({ type: 'text', text: 'Привет' })
  })

  it('coalesces image-block alt via locale', async () => {
    await insertLocalization(db, `block:${IMAGE_BLOCK}:alt`, 'ru', 'Подпись')
    const blocks = await new BlockStore(db).getByParent(onPost, { locale: 'ru' })
    const image = blocks.find((b) => b.id === IMAGE_BLOCK)!
    expect(image.content).toMatchObject({ type: 'image', alt: 'Подпись' })
  })

  it('recurses translations through group blocks', async () => {
    await insertBlock(db, GROUP_BLOCK, 'group', { type: 'group', key: 'g1' })
    await attach(db, GROUP_BLOCK, 'post', POST_ID)
    await insertBlock(db, CHILD_BLOCK, 'text', { type: 'text', key: 'c1', text: 'Nested' })
    await attach(db, CHILD_BLOCK, 'block', GROUP_BLOCK)
    await insertLocalization(db, `block:${CHILD_BLOCK}:text`, 'ru', 'Вложенный')

    const blocks = await new BlockStore(db).getByParent(onPost, { locale: 'ru' })
    const group = blocks.find((b) => b.id === GROUP_BLOCK)!
    if (group.content.type !== 'group') throw new Error('unreachable')
    expect(group.content.blocks[0].content).toMatchObject({ type: 'text', text: 'Вложенный' })
  })

  it('falls back to source text when no localization exists for that locale', async () => {
    await insertLocalization(db, `block:${TEXT_BLOCK}:text`, 'ru', 'Привет')
    const blocks = await new BlockStore(db).getByParent(onPost, { locale: 'en' })
    const text = blocks.find((b) => b.id === TEXT_BLOCK)!
    expect(text.content).toMatchObject({ type: 'text', text: 'Hello' })
  })

  it('returns [] for an empty value', async () => {
    expect(await new BlockStore(db).getByParent({ table: 'post', column: 'id', value: '' })).toEqual([])
  })

  it('throws InvalidIdentifierError for an unknown parent.table', async () => {
    await expect(
      // @ts-expect-error — runtime check kicks in even when types are bypassed
      new BlockStore(db).getByParent({ table: 'bogus', column: 'id', value: POST_ID }),
    ).rejects.toThrow(InvalidIdentifierError)
  })

  it('rejects column = "shortid" when parent is a block (only "id" is allowed)', async () => {
    await expect(
      // @ts-expect-error — block parents only allow column='id'; runtime check enforces it too
      new BlockStore(db).getByParent({ table: 'block', column: 'shortid', value: GROUP_BLOCK }),
    ).rejects.toThrow(InvalidIdentifierError)
  })

  it('looks up blocks by category shortid', async () => {
    await db.run(
      'INSERT INTO category (id, shortid, name, slug) VALUES (?, ?, ?, ?)',
      CATEGORY_ID,
      'cat-short',
      'Cats',
      'cats',
    )
    await insertBlock(db, '019dbcea-d3a4-75e7-b37a-190d51650b05', 'text', {
      type: 'text',
      key: 't2',
      text: 'On category',
    })
    await attach(db, '019dbcea-d3a4-75e7-b37a-190d51650b05', 'category', CATEGORY_ID)

    const blocks = await new BlockStore(db).getByParent({
      table: 'category',
      column: 'shortid',
      value: 'cat-short',
    })
    expect(blocks.map((b) => b.content)).toEqual([
      expect.objectContaining({ type: 'text', text: 'On category' }),
    ])
  })
})

async function insertBlock(
  db: Database,
  id: string,
  type: string,
  content: object,
): Promise<void> {
  await db.run('INSERT INTO block (id, type, content) VALUES (?, ?, ?)', id, type, JSON.stringify(content))
}

async function attach(
  db: Database,
  blockId: string,
  parentTable: string,
  parentId: string,
): Promise<void> {
  await db.run(
    'INSERT INTO parent_block (blockId, parentId, parentTable) VALUES (?, ?, ?)',
    blockId,
    parentId,
    parentTable,
  )
}

async function insertLocalization(
  db: Database,
  key: string,
  locale: string,
  text: string,
): Promise<void> {
  await db.run(
    'INSERT INTO localizations (id, key, locale, text) VALUES (?, ?, ?, ?)',
    `loc-${key}-${locale}`,
    key,
    locale,
    text,
  )
}
