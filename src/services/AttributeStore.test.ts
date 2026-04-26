import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Database } from 'sqlite'
import { AttributeStore } from './AttributeStore'
import { InvalidIdentifierError } from './getByParentQuery'
import { createTestDb } from '../test/db'

const POST_ID = '019dbcea-d3a4-75e7-b37a-190d5165aaaa'
const PAGE_ID = '019dbcea-d3a4-75e7-b37a-190d5165cccc'

const ATTR_PLAIN = '019dbcea-d3a4-75e7-b37a-190d51650a01'
const ATTR_TRANSLATABLE = '019dbcea-d3a4-75e7-b37a-190d51650a02'

describe('AttributeStore.getByParent', () => {
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
    await db.run('INSERT INTO page (id, key) VALUES (?, ?)', PAGE_ID, 'about')
    await insertAttribute(db, ATTR_PLAIN, 'author', false, 'Alice')
    await attach(db, ATTR_PLAIN, 'post', POST_ID)
    await insertAttribute(db, ATTR_TRANSLATABLE, 'subtitle', true, 'Welcome')
    await attach(db, ATTR_TRANSLATABLE, 'post', POST_ID)
  })

  afterEach(async () => {
    await db.close()
  })

  it('returns attributes attached to a parent and converts translatable int → bool', async () => {
    const attrs = await new AttributeStore(db).getByParent('post', 'id', POST_ID)
    expect(attrs).toHaveLength(2)
    const author = attrs.find((a) => a.key === 'author')!
    const subtitle = attrs.find((a) => a.key === 'subtitle')!
    expect(author.translatable).toBe(false)
    expect(subtitle.translatable).toBe(true)
    expect(author.text).toBe('Alice')
    expect(subtitle.text).toBe('Welcome')
  })

  it('coalesces text against localizations only when translatable=1', async () => {
    await insertLocalization(db, `attribute:${ATTR_TRANSLATABLE}:text`, 'ru', 'Привет')
    await insertLocalization(db, `attribute:${ATTR_PLAIN}:text`, 'ru', 'Алиса')

    const attrs = await new AttributeStore(db).getByParent('post', 'id', POST_ID, { locale: 'ru' })
    const author = attrs.find((a) => a.key === 'author')!
    const subtitle = attrs.find((a) => a.key === 'subtitle')!
    // translatable=true → coalesces from localizations
    expect(subtitle.text).toBe('Привет')
    // translatable=false → returns own text, ignores localizations
    expect(author.text).toBe('Alice')
  })

  it('falls back to source text when no localization for the requested locale', async () => {
    await insertLocalization(db, `attribute:${ATTR_TRANSLATABLE}:text`, 'ru', 'Привет')
    const attrs = await new AttributeStore(db).getByParent('post', 'id', POST_ID, { locale: 'en' })
    const subtitle = attrs.find((a) => a.key === 'subtitle')!
    expect(subtitle.text).toBe('Welcome')
  })

  it('supports a different parent kind (page) with column = "key"', async () => {
    const attrId = '019dbcea-d3a4-75e7-b37a-190d51650a03'
    await insertAttribute(db, attrId, 'lang', false, 'en')
    await attach(db, attrId, 'page', PAGE_ID)

    const attrs = await new AttributeStore(db).getByParent('page', 'key', 'about')
    expect(attrs.map((a) => a.key)).toEqual(['lang'])
  })

  it('orders by the requested column', async () => {
    const attrs = await new AttributeStore(db).getByParent('post', 'id', POST_ID, {
      order: { field: 'key', order: 'asc' },
    })
    expect(attrs.map((a) => a.key)).toEqual(['author', 'subtitle'])
  })

  it('returns [] for an empty id', async () => {
    expect(await new AttributeStore(db).getByParent('post', 'id', '')).toEqual([])
  })

  it('throws InvalidIdentifierError for an unknown parentTable', async () => {
    await expect(
      // @ts-expect-error — runtime check
      new AttributeStore(db).getByParent('user', 'id', POST_ID),
    ).rejects.toThrow(InvalidIdentifierError)
  })

  it('rejects column = "key" when parent is a post (only id/shortid)', async () => {
    await expect(
      // @ts-expect-error — runtime check
      new AttributeStore(db).getByParent('post', 'key', POST_ID),
    ).rejects.toThrow(InvalidIdentifierError)
  })
})

async function insertAttribute(
  db: Database,
  id: string,
  key: string,
  translatable: boolean,
  text: string,
): Promise<void> {
  await db.run(
    'INSERT INTO attribute (id, key, translatable, text) VALUES (?, ?, ?, ?)',
    id,
    key,
    translatable ? 1 : 0,
    text,
  )
}

async function attach(
  db: Database,
  attributeId: string,
  parentTable: string,
  parentId: string,
): Promise<void> {
  await db.run(
    'INSERT INTO parent_attribute (attributeId, parentId, parentTable) VALUES (?, ?, ?)',
    attributeId,
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
