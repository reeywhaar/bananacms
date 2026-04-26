import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Database } from 'sqlite'
import { TagStore } from './TagStore'
import { InvalidIdentifierError } from './getByParentQuery'
import { createTestDb } from '../test/db'

const POST_A = '019dbcea-d3a4-75e7-b37a-190d5165aaaa'
const POST_B = '019dbcea-d3a4-75e7-b37a-190d5165bbbb'

const TAG_ALPHA = '019dbcea-d3a4-75e7-b37a-190d51650111'
const TAG_BRAVO = '019dbcea-d3a4-75e7-b37a-190d51650222'
const TAG_CHARLIE = '019dbcea-d3a4-75e7-b37a-190d51650333'

describe('TagStore.getByParent', () => {
  let db: Database

  beforeEach(async () => {
    db = await createTestDb()
    await insertPost(db, POST_A, 'Post A')
    await insertPost(db, POST_B, 'Post B')
    await insertTag(db, TAG_ALPHA, 'alpha-short', 'Bravo', 'bravo')
    await insertTag(db, TAG_BRAVO, 'bravo-short', 'Alpha', 'alpha')
    await insertTag(db, TAG_CHARLIE, 'charlie-short', 'Charlie', 'charlie')
    // Bravo + Alpha on POST_A (note name vs id ordering)
    await link(db, TAG_ALPHA, POST_A)
    await link(db, TAG_BRAVO, POST_A)
    // Bravo + Charlie on POST_B (many-to-many: TAG_BRAVO is shared)
    await link(db, TAG_BRAVO, POST_B)
    await link(db, TAG_CHARLIE, POST_B)
  })

  afterEach(async () => {
    await db.close()
  })

  const onPostA = { table: 'post', column: 'id', value: POST_A } as const

  it('returns tags attached to a post, ordered by name by default', async () => {
    const tags = await new TagStore(db).getByParent(onPostA)
    expect(tags.map((t) => t.name)).toEqual(['Alpha', 'Bravo'])
  })

  it('handles many-to-many: same tag returned for both posts', async () => {
    const a = await new TagStore(db).getByParent(onPostA)
    const b = await new TagStore(db).getByParent({ table: 'post', column: 'id', value: POST_B })
    expect(a.find((t) => t.id === TAG_BRAVO)).toBeDefined()
    expect(b.find((t) => t.id === TAG_BRAVO)).toBeDefined()
  })

  it('coalesces name via locale', async () => {
    await insertLocalization(db, `tag:${TAG_BRAVO}:name`, 'ru', 'Альфа')
    const tags = await new TagStore(db).getByParent(onPostA, { locale: 'ru' })
    const bravo = tags.find((t) => t.id === TAG_BRAVO)
    expect(bravo?.name).toBe('Альфа')
  })

  it('supports custom order field', async () => {
    const tags = await new TagStore(db).getByParent(onPostA, {
      order: { field: 'name', order: 'desc' },
    })
    expect(tags.map((t) => t.name)).toEqual(['Bravo', 'Alpha'])
  })

  it('looks up by post shortid', async () => {
    const byId = await new TagStore(db).getByParent(onPostA)
    const byShortId = await new TagStore(db).getByParent({
      table: 'post',
      column: 'shortid',
      value: POST_A.slice(-8),
    })
    expect(byShortId.map((t) => t.id)).toEqual(byId.map((t) => t.id))
  })

  it('returns [] for an unknown parent value', async () => {
    expect(
      await new TagStore(db).getByParent({ table: 'post', column: 'id', value: 'no-such-post' }),
    ).toEqual([])
  })

  it('throws InvalidIdentifierError for an unknown parent.table', async () => {
    await expect(
      // @ts-expect-error — runtime check
      new TagStore(db).getByParent({ table: 'category', column: 'id', value: POST_A }),
    ).rejects.toThrow(InvalidIdentifierError)
  })
})

async function insertPost(db: Database, id: string, name: string): Promise<void> {
  await db.run(
    'INSERT INTO post (id, shortid, name, slug, status) VALUES (?, ?, ?, ?, ?)',
    id,
    id.slice(-8),
    name,
    name.toLowerCase().replace(/\s+/g, '-'),
    'published',
  )
}

async function insertTag(
  db: Database,
  id: string,
  shortid: string,
  name: string,
  slug: string,
): Promise<void> {
  await db.run(
    'INSERT INTO tag (id, shortid, name, slug) VALUES (?, ?, ?, ?)',
    id,
    shortid,
    name,
    slug,
  )
}

async function link(db: Database, tagId: string, postId: string): Promise<void> {
  await db.run(
    'INSERT INTO parent_tag (tagId, parentId, parentTable) VALUES (?, ?, ?)',
    tagId,
    postId,
    'post',
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
