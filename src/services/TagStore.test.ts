import { describe, it, expect } from 'vitest'
import { TagStore } from './TagStore'
import { AttributeStore } from './AttributeStore'
import { BlockStore } from './BlockStore'
import { createTestDb, type TestDb } from '../test/db'
import { localizations, parentTag, post, tag } from '@cms/lib/db/schema'

const POST_A = '019dbcea-d3a4-75e7-b37a-190d5165aaaa'
const POST_B = '019dbcea-d3a4-75e7-b37a-190d5165bbbb'

const TAG_ALPHA = '019dbcea-d3a4-75e7-b37a-190d51650111'
const TAG_BRAVO = '019dbcea-d3a4-75e7-b37a-190d51650222'
const TAG_CHARLIE = '019dbcea-d3a4-75e7-b37a-190d51650333'

describe('TagStore.query', () => {
  it('returns tags attached to a post, ordered by name by default', async () => {
    using testDb = await createTestDb()
    await seedPostsAndTags(testDb)
    const tags = await new TagStore(testDb.db).query().taggedTo({ table: 'post', id: POST_A }).all()
    expect(tags.map((t) => t.name)).toEqual(['Alpha', 'Bravo'])
  })

  it('handles many-to-many: same tag returned for both posts', async () => {
    using testDb = await createTestDb()
    await seedPostsAndTags(testDb)
    const a = await new TagStore(testDb.db).query().taggedTo({ table: 'post', id: POST_A }).all()
    const b = await new TagStore(testDb.db).query().taggedTo({ table: 'post', id: POST_B }).all()
    expect(a.find((t) => t.id === TAG_BRAVO)).toBeDefined()
    expect(b.find((t) => t.id === TAG_BRAVO)).toBeDefined()
  })

  it('coalesces name via locale (taggedTo)', async () => {
    using testDb = await createTestDb()
    await seedPostsAndTags(testDb)
    await insertLocalization(testDb, `tag:${TAG_BRAVO}:name`, 'ru', 'Альфа')
    const tags = await new TagStore(testDb.db)
      .query()
      .taggedTo({ table: 'post', id: POST_A })
      .locale('ru')
      .all()
    expect(tags.find((t) => t.id === TAG_BRAVO)?.name).toBe('Альфа')
  })

  it('supports custom order field', async () => {
    using testDb = await createTestDb()
    await seedPostsAndTags(testDb)
    const tags = await new TagStore(testDb.db)
      .query()
      .taggedTo({ table: 'post', id: POST_A })
      .orderBy('name', 'desc')
      .all()
    expect(tags.map((t) => t.name)).toEqual(['Bravo', 'Alpha'])
  })

  it('looks up by post shortid', async () => {
    using testDb = await createTestDb()
    await seedPostsAndTags(testDb)
    const byId = await new TagStore(testDb.db).query().taggedTo({ table: 'post', id: POST_A }).all()
    const byShortId = await new TagStore(testDb.db)
      .query()
      .taggedTo({ table: 'post', shortid: POST_A.slice(-8) })
      .all()
    expect(byShortId.map((t) => t.id)).toEqual(byId.map((t) => t.id))
  })

  it('returns [] for an unknown parent value', async () => {
    using testDb = await createTestDb()
    await seedPostsAndTags(testDb)
    expect(
      await new TagStore(testDb.db).query().taggedTo({ table: 'post', id: 'no-such-post' }).all(),
    ).toEqual([])
  })

  it('all + withPostCount returns every tag with postCount', async () => {
    using testDb = await createTestDb()
    await seedPostsAndTags(testDb)
    const tags = await new TagStore(testDb.db).query().withPostCount().all()
    expect(tags.map((t) => t.name)).toEqual(['Alpha', 'Bravo', 'Charlie'])
    expect(tags.find((t) => t.name === 'Alpha')?.postCount).toBe(2)
    expect(tags.find((t) => t.name === 'Bravo')?.postCount).toBe(1)
    expect(tags.find((t) => t.name === 'Charlie')?.postCount).toBe(1)
  })

  it('all coalesces names via locale', async () => {
    using testDb = await createTestDb()
    await seedPostsAndTags(testDb)
    await insertLocalization(testDb, `tag:${TAG_BRAVO}:name`, 'ru', 'Альфа')
    const tags = await new TagStore(testDb.db).query().locale('ru').all()
    expect(tags.find((t) => t.id === TAG_BRAVO)?.name).toBe('Альфа')
  })

  it('byShortId fetches a single tag', async () => {
    using testDb = await createTestDb()
    await seedPostsAndTags(testDb)
    const tag = await new TagStore(testDb.db).query().byShortId('alphshrt').first()
    expect(tag?.id).toBe(TAG_ALPHA)
  })

  it('bySlug fetches a single tag', async () => {
    using testDb = await createTestDb()
    await seedPostsAndTags(testDb)
    const tag = await new TagStore(testDb.db).query().bySlug('charlie').first()
    expect(tag?.id).toBe(TAG_CHARLIE)
  })

  describe('attributes', () => {
    const TAG_NEW = '019dbcea-d3a4-75e7-b37a-190d51650999'

    it('persists attributes via add() and reads them back via AttributeStore.query', async () => {
      using testDb = await createTestDb()
      await new TagStore(testDb.db).add(TAG_NEW, {
        name: 'Featured',
        slug: 'featured',
        blocks: [],
        translations: {},
        attributes: [
          { id: 'attr-1', key: 'priority', translatable: false, text: 'high' },
          { id: 'attr-2', key: 'caption', translatable: true, text: 'Featured tag' },
        ],
      })

      const attrs = await new AttributeStore(testDb.db)
        .query()
        .parentedBy({ table: 'tag', id: TAG_NEW })
        .all()
      expect(attrs.map((a) => a.key).sort()).toEqual(['caption', 'priority'])
    })

    it('replaces attributes on update()', async () => {
      using testDb = await createTestDb()
      await new TagStore(testDb.db).add(TAG_NEW, {
        name: 'Featured',
        slug: 'featured',
        blocks: [],
        translations: {},
        attributes: [{ id: 'attr-old', key: 'priority', translatable: false, text: 'high' }],
      })
      await new TagStore(testDb.db).update(TAG_NEW, {
        name: 'Featured',
        slug: 'featured',
        blocks: [],
        translations: {},
        attributes: [{ id: 'attr-new', key: 'mood', translatable: false, text: 'calm' }],
      })

      const attrs = await new AttributeStore(testDb.db)
        .query()
        .parentedBy({ table: 'tag', id: TAG_NEW })
        .all()
      expect(attrs.map((a) => a.key)).toEqual(['mood'])
    })

    it('cascades attribute deletion when a tag is deleted', async () => {
      using testDb = await createTestDb()
      await new TagStore(testDb.db).add(TAG_NEW, {
        name: 'Featured',
        slug: 'featured',
        blocks: [],
        translations: {},
        attributes: [{ id: 'attr-cascade', key: 'priority', translatable: false, text: 'high' }],
      })
      await new TagStore(testDb.db).delete(TAG_NEW)

      const attrs = await new AttributeStore(testDb.db)
        .query()
        .parentedBy({ table: 'tag', id: TAG_NEW })
        .all()
      expect(attrs).toEqual([])
    })
  })

  describe('blocks', () => {
    const TAG_NEW = '019dbcea-d3a4-75e7-b37a-190d51650abc'

    it('persists blocks via add() and reads them back via BlockStore.query', async () => {
      using testDb = await createTestDb()
      await new TagStore(testDb.db).add(TAG_NEW, {
        name: 'Featured',
        slug: 'featured',
        translations: {},
        attributes: [],
        blocks: [
          {
            id: 'b-tag-text',
            parent: { type: 'tag', id: TAG_NEW },
            content: {
              type: 'text',
              key: 'desc',
              contentType: 'plain' as const,
              text: 'Featured description',
            },
            attributes: [],
          },
        ],
      })

      const blocks = await new BlockStore(testDb.db)
        .query()
        .parentedBy({ table: 'tag', id: TAG_NEW })
        .all()
      expect(blocks.map((b) => b.id)).toEqual(['b-tag-text'])
      expect(blocks[0].content).toMatchObject({ type: 'text', text: 'Featured description' })
    })

    it('cascades block deletion when a tag is deleted', async () => {
      using testDb = await createTestDb()
      await new TagStore(testDb.db).add(TAG_NEW, {
        name: 'Featured',
        slug: 'featured',
        translations: {},
        attributes: [],
        blocks: [
          {
            id: 'b-cascade',
            parent: { type: 'tag', id: TAG_NEW },
            content: { type: 'text', key: 't', contentType: 'plain' as const, text: 'x' },
            attributes: [],
          },
        ],
      })
      await new TagStore(testDb.db).delete(TAG_NEW)

      const blocks = await new BlockStore(testDb.db)
        .query()
        .parentedBy({ table: 'tag', id: TAG_NEW })
        .all()
      expect(blocks).toEqual([])
    })
  })

  describe('indexOf', () => {
    it('returns 0 for the first tag in name order', async () => {
      using testDb = await createTestDb()
      await seedPostsAndTags(testDb)
      // default order is name asc: Alpha, Bravo, Charlie
      const idx = await new TagStore(testDb.db).query().indexOf((q) => q.byShortId('bravshrt'))
      expect(idx).toBe(0)
    })

    it('returns 1 for the second tag', async () => {
      using testDb = await createTestDb()
      await seedPostsAndTags(testDb)
      const idx = await new TagStore(testDb.db).query().indexOf((q) => q.byShortId('alphshrt'))
      expect(idx).toBe(1)
    })

    it('returns 2 for the last tag', async () => {
      using testDb = await createTestDb()
      await seedPostsAndTags(testDb)
      const idx = await new TagStore(testDb.db).query().indexOf((q) => q.byShortId('charshrt'))
      expect(idx).toBe(2)
    })

    it('returns -1 when anchor does not exist', async () => {
      using testDb = await createTestDb()
      await seedPostsAndTags(testDb)
      const idx = await new TagStore(testDb.db).query().indexOf((q) => q.byShortId('no-such'))
      expect(idx).toBe(-1)
    })

    it('works with orderBy name desc', async () => {
      using testDb = await createTestDb()
      await seedPostsAndTags(testDb)
      // desc: Charlie(0), Bravo(1), Alpha(2) — note: TAG_BRAVO has name 'Alpha'
      const idx = await new TagStore(testDb.db)
        .query()
        .orderBy('name', 'desc')
        .indexOf((q) => q.byShortId('bravshrt'))
      expect(idx).toBe(2)
    })
  })
})

// ─── seed fixtures ───────────────────────────────────────────────────────────

async function seedPostsAndTags(testDb: TestDb): Promise<void> {
  await insertPost(testDb, POST_A, 'Post A')
  await insertPost(testDb, POST_B, 'Post B')
  await insertTag(testDb, TAG_ALPHA, 'alphshrt', 'Bravo', 'bravo')
  await insertTag(testDb, TAG_BRAVO, 'bravshrt', 'Alpha', 'alpha')
  await insertTag(testDb, TAG_CHARLIE, 'charshrt', 'Charlie', 'charlie')
  await link(testDb, TAG_ALPHA, POST_A)
  await link(testDb, TAG_BRAVO, POST_A)
  await link(testDb, TAG_BRAVO, POST_B)
  await link(testDb, TAG_CHARLIE, POST_B)
}

async function insertPost(testDb: TestDb, id: string, name: string): Promise<void> {
  await testDb.db.insert(post).values({
    id,
    shortid: id.slice(-8),
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    status: 'published',
  })
}

async function insertTag(
  testDb: TestDb,
  id: string,
  shortid: string,
  name: string,
  slug: string,
): Promise<void> {
  await testDb.db.insert(tag).values({ id, shortid, name, slug })
}

async function link(testDb: TestDb, tagId: string, postId: string): Promise<void> {
  await testDb.db.insert(parentTag).values({ tagId, parentId: postId, parentTable: 'post' })
}

async function insertLocalization(
  testDb: TestDb,
  key: string,
  locale: string,
  text: string,
): Promise<void> {
  await testDb.db.insert(localizations).values({ id: `loc-${key}-${locale}`, key, locale, text })
}
