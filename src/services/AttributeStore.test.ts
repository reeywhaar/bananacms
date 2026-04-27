import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AttributeStore } from './AttributeStore'
import { createTestDb, type TestDb } from '../test/db'
import {
  post,
  page,
  attribute,
  parentAttribute,
  localizations,
} from '@cms/lib/db/schema'

const POST_ID = '019dbcea-d3a4-75e7-b37a-190d5165aaaa'
const PAGE_ID = '019dbcea-d3a4-75e7-b37a-190d5165cccc'

const ATTR_PLAIN = '019dbcea-d3a4-75e7-b37a-190d51650a01'
const ATTR_TRANSLATABLE = '019dbcea-d3a4-75e7-b37a-190d51650a02'

describe('AttributeStore.query', () => {
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
    await testDb.db.insert(page).values({ id: PAGE_ID, key: 'about' }).run()
    await insertAttribute(testDb, ATTR_PLAIN, 'author', false, 'Alice')
    await attach(testDb, ATTR_PLAIN, 'post', POST_ID)
    await insertAttribute(testDb, ATTR_TRANSLATABLE, 'subtitle', true, 'Welcome')
    await attach(testDb, ATTR_TRANSLATABLE, 'post', POST_ID)
  })

  afterEach(async () => {
    testDb.client.close()
  })

  it('returns attributes attached to a parent and converts translatable int → bool', async () => {
    const attrs = await new AttributeStore(testDb.db)
      .query()
      .parentedBy({ table: 'post', id: POST_ID })
      .all()
    expect(attrs).toHaveLength(2)
    const author = attrs.find((a) => a.key === 'author')!
    const subtitle = attrs.find((a) => a.key === 'subtitle')!
    expect(author.translatable).toBe(false)
    expect(subtitle.translatable).toBe(true)
    expect(author.text).toBe('Alice')
    expect(subtitle.text).toBe('Welcome')
  })

  it('coalesces text against localizations only when translatable=1', async () => {
    await insertLocalization(testDb, `attribute:${ATTR_TRANSLATABLE}:text`, 'ru', 'Привет')
    await insertLocalization(testDb, `attribute:${ATTR_PLAIN}:text`, 'ru', 'Алиса')

    const attrs = await new AttributeStore(testDb.db)
      .query()
      .parentedBy({ table: 'post', id: POST_ID })
      .locale('ru')
      .all()
    const author = attrs.find((a) => a.key === 'author')!
    const subtitle = attrs.find((a) => a.key === 'subtitle')!
    expect(subtitle.text).toBe('Привет')
    expect(author.text).toBe('Alice')
  })

  it('falls back to source text when no localization for the requested locale', async () => {
    await insertLocalization(testDb, `attribute:${ATTR_TRANSLATABLE}:text`, 'ru', 'Привет')
    const attrs = await new AttributeStore(testDb.db)
      .query()
      .parentedBy({ table: 'post', id: POST_ID })
      .locale('en')
      .all()
    const subtitle = attrs.find((a) => a.key === 'subtitle')!
    expect(subtitle.text).toBe('Welcome')
  })

  it('supports a different parent kind (page) with column = "key"', async () => {
    const attrId = '019dbcea-d3a4-75e7-b37a-190d51650a03'
    await insertAttribute(testDb, attrId, 'lang', false, 'en')
    await attach(testDb, attrId, 'page', PAGE_ID)

    const attrs = await new AttributeStore(testDb.db)
      .query()
      .parentedBy({ table: 'page', key: 'about' })
      .all()
    expect(attrs.map((a) => a.key)).toEqual(['lang'])
  })

  it('orders by the requested column', async () => {
    const attrs = await new AttributeStore(testDb.db)
      .query()
      .parentedBy({ table: 'post', id: POST_ID })
      .orderBy('key')
      .all()
    expect(attrs.map((a) => a.key)).toEqual(['author', 'subtitle'])
  })
})

async function insertAttribute(
  testDb: TestDb,
  id: string,
  key: string,
  translatable: boolean,
  text: string,
): Promise<void> {
  await testDb.db
    .insert(attribute)
    .values({ id, key, translatable: translatable ? 1 : 0, text })
    .run()
}

async function attach(
  testDb: TestDb,
  attributeId: string,
  parentTable: string,
  parentId: string,
): Promise<void> {
  await testDb.db.insert(parentAttribute).values({ attributeId, parentId, parentTable }).run()
}

async function insertLocalization(
  testDb: TestDb,
  key: string,
  locale: string,
  text: string,
): Promise<void> {
  await testDb.db.insert(localizations).values({ id: `loc-${key}-${locale}`, key, locale, text }).run()
}
