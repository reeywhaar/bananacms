import { describe, it, expect } from 'vitest'
import { PostStore } from './PostStore'
import { createTestDb, type TestDb } from '../test/db'
import {
  post as postTable,
  parentPost,
  parentTag,
  tag,
  localizations,
  category,
  attribute,
  parentAttribute,
  block,
  parentBlock,
} from '@cms/lib/db/schema'

const CATEGORY_ID = '019dbce5-5aac-763a-ac29-509b1a86750f'
const CATEGORY_SHORTID = '1a86750f'

const POST_A = '019dbcea-d3a4-75e7-b37a-190d5165077a'
const POST_B = '019dbcea-d3a4-75e7-b37a-190d5165077b'
const POST_C = '019dbcea-d3a4-75e7-b37a-190d5165077c'

const CATEGORY_ID_2 = '019dbce5-5aac-763a-ac29-509b1a86750e'
const CATEGORY_SHORTID_2 = '1a86750e'

const POST_D = '019dbcea-d3a4-75e7-b37a-190d5165077d'
const POST_E = '019dbcea-d3a4-75e7-b37a-190d5165077e'

const TAG_RED = '019dbcf0-0000-7000-0000-000000000001'
const TAG_BLUE = '019dbcf0-0000-7000-0000-000000000002'

describe('PostStore.query', () => {
  describe('inCategory', () => {
    it('returns all posts in a category, ordered by parent_post.position', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const posts = await new PostStore(testDb.db).query().inCategory({ id: CATEGORY_ID }).all()
      expect(posts.map((p) => p.name)).toEqual(['Apple', 'Banana', 'Cherry'])
      expect(posts.at(0)?.categoryId).toBe(CATEGORY_ID)
    })

    it('looks up by category slug', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const byId = await new PostStore(testDb.db).query().inCategory({ id: CATEGORY_ID }).all()
      const bySlug = await new PostStore(testDb.db).query().inCategory({ slug: 'birds' }).all()
      expect(bySlug.map((p) => p.id)).toEqual(byId.map((p) => p.id))
    })

    it('inCategory({ ids }) matches any of the listed categories', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const posts = await new PostStore(testDb.db)
        .query()
        .inCategory({ ids: [CATEGORY_ID, 'no-such-cat'] })
        .all()
      expect(posts.map((p) => p.name)).toEqual(['Apple', 'Banana', 'Cherry'])
    })

    it('inCategory({ ids: [] }) returns no posts', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const posts = await new PostStore(testDb.db).query().inCategory({ ids: [] }).all()
      expect(posts).toEqual([])
    })

    it('filters out drafts when .published()', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const posts = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .published()
        .all()
      expect(posts.map((p) => p.name)).toEqual(['Apple', 'Cherry'])
    })

    it('returns only drafts when .draft()', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const posts = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .draft()
        .all()
      expect(posts.map((p) => p.name)).toEqual(['Banana'])
    })

    it('coalesces the name field against localizations when locale is set', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await testDb.db
        .insert(localizations)
        .values({ id: 'l1', key: `post:${POST_A}:name`, locale: 'ru', text: 'Яблоко' })
      const posts = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .locale('ru')
        .all()
      expect(posts.find((p) => p.id === POST_A)?.name).toBe('Яблоко')
      expect(posts.find((p) => p.id === POST_B)?.name).toBe('Banana')
    })

    it('honors custom order field with secondary id tiebreaker', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const posts = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .orderBy('name', 'desc')
        .all()
      expect(posts.map((p) => p.name)).toEqual(['Cherry', 'Banana', 'Apple'])
    })

    it('applies limit and offset', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const page = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .limit(1)
        .offset(1)
        .all()
      expect(page.map((p) => p.name)).toEqual(['Banana'])
    })
  })

  describe('all', () => {
    it('returns every post ordered by parent_post.position', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const posts = await new PostStore(testDb.db).query().all()
      expect(posts.map((p) => p.name)).toEqual(['Apple', 'Banana', 'Cherry'])
    })

    it('coalesces names via locale', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await testDb.db
        .insert(localizations)
        .values({ id: 'l1', key: `post:${POST_A}:name`, locale: 'ru', text: 'Яблоко' })
      const posts = await new PostStore(testDb.db).query().locale('ru').all()
      expect(posts.find((p) => p.id === POST_A)?.name).toBe('Яблоко')
    })

    it('respects status filter', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const posts = await new PostStore(testDb.db).query().draft().all()
      expect(posts.map((p) => p.name)).toEqual(['Banana'])
    })
  })

  describe('column', () => {
    it('byId fetches a single post', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const post = await new PostStore(testDb.db).query().byId(POST_A).first()
      expect(post?.name).toBe('Apple')
    })

    it('byShortId fetches a single post', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const post = await new PostStore(testDb.db).query().byShortId(POST_A.slice(-8)).first()
      expect(post?.id).toBe(POST_A)
    })

    it('bySlug fetches a single post', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const post = await new PostStore(testDb.db).query().bySlug('banana').first()
      expect(post?.id).toBe(POST_B)
    })
  })

  describe('tags', () => {
    it('withTag by id returns posts that have the tag', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedTags(testDb)
      const posts = await new PostStore(testDb.db).query().withTag({ id: TAG_RED }).all()
      expect(posts.map((p) => p.name)).toEqual(['Apple', 'Banana'])
      expect(posts.at(0)?.categoryId).toBe(CATEGORY_ID)
    })

    it('withTag by shortid and slug', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedTags(testDb)
      const byShortid = await new PostStore(testDb.db)
        .query()
        .withTag({ shortid: TAG_BLUE.slice(-8) })
        .all()
      const bySlug = await new PostStore(testDb.db).query().withTag({ slug: 'blue' }).all()
      expect(byShortid.map((p) => p.id)).toEqual([POST_B, POST_C])
      expect(bySlug.map((p) => p.id)).toEqual([POST_B, POST_C])
    })

    it('withoutTag excludes posts that have that tag', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedTags(testDb)
      const posts = await new PostStore(testDb.db).query().withoutTag({ slug: 'red' }).all()
      expect(posts.map((p) => p.name)).toEqual(['Cherry'])
    })

    it('respects status filter', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedTags(testDb)
      const posts = await new PostStore(testDb.db)
        .query()
        .withTag({ id: TAG_RED })
        .published()
        .all()
      expect(posts.map((p) => p.name)).toEqual(['Apple'])
    })

    it('honors order field', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedTags(testDb)
      const posts = await new PostStore(testDb.db)
        .query()
        .withTag({ id: TAG_RED })
        .orderBy('name', 'desc')
        .all()
      expect(posts.map((p) => p.name)).toEqual(['Banana', 'Apple'])
    })

    it('coalesces names against localizations', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedTags(testDb)
      await testDb.db
        .insert(localizations)
        .values({ id: 'l1', key: `post:${POST_A}:name`, locale: 'ru', text: 'Яблоко' })
      const posts = await new PostStore(testDb.db)
        .query()
        .withTag({ id: TAG_RED })
        .locale('ru')
        .all()
      expect(posts.find((p) => p.id === POST_A)?.name).toBe('Яблоко')
    })

    it('applies limit and offset', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedTags(testDb)
      const page = await new PostStore(testDb.db)
        .query()
        .withTag({ id: TAG_RED })
        .limit(1)
        .offset(1)
        .all()
      expect(page.map((p) => p.name)).toEqual(['Banana'])
    })

    it('withAnyTag matches OR across specs', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedTags(testDb)
      const posts = await new PostStore(testDb.db)
        .query()
        .withAnyTag([{ slug: 'red' }, { slug: 'blue' }])
        .all()
      expect(posts.map((p) => p.id).sort()).toEqual([POST_A, POST_B, POST_C].sort())
    })
  })

  describe('attributes', () => {
    it('withAttribute by key matches posts with that key (any value)', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedAttributes(testDb)
      const posts = await new PostStore(testDb.db).query().withAttribute({ key: 'author' }).all()
      expect(posts.map((p) => p.id).sort()).toEqual([POST_A, POST_B].sort())
    })

    it('withAttribute by key + value matches exact text', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedAttributes(testDb)
      const posts = await new PostStore(testDb.db)
        .query()
        .withAttribute({ key: 'author', value: 'Alice' })
        .all()
      expect(posts.map((p) => p.id)).toEqual([POST_A])
    })

    it('withAttribute by key + valueLike matches LIKE pattern', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedAttributes(testDb)
      const posts = await new PostStore(testDb.db)
        .query()
        .withAttribute({ key: 'lang', valueLike: 'e%' })
        .all()
      expect(posts.map((p) => p.id)).toEqual([POST_B])
    })

    it('withoutAttribute excludes posts with that key', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedAttributes(testDb)
      const posts = await new PostStore(testDb.db).query().withoutAttribute({ key: 'lang' }).all()
      expect(posts.map((p) => p.id)).toEqual([POST_A])
    })

    it('withoutAttribute by key + value only excludes exact matches', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedAttributes(testDb)
      const posts = await new PostStore(testDb.db)
        .query()
        .withoutAttribute({ key: 'author', value: 'Alice' })
        .all()
      expect(posts.map((p) => p.id).sort()).toEqual([POST_B, POST_C].sort())
    })

    it('withAnyAttribute matches OR across specs', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedAttributes(testDb)
      const posts = await new PostStore(testDb.db)
        .query()
        .withAnyAttribute([
          { key: 'author', value: 'Alice' },
          { key: 'lang', value: 'fr' },
        ])
        .all()
      expect(posts.map((p) => p.id).sort()).toEqual([POST_A, POST_C].sort())
    })

    it('withAllAttributes requires every spec to match (one EXISTS each)', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedAttributes(testDb)
      const posts = await new PostStore(testDb.db)
        .query()
        .withAllAttributes([
          { key: 'author', value: 'Bob' },
          { key: 'lang', value: 'en' },
        ])
        .all()
      expect(posts.map((p) => p.id)).toEqual([POST_B])
    })

    it('combines with other filters via AND', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedAttributes(testDb)
      const posts = await new PostStore(testDb.db)
        .query()
        .withAttribute({ key: 'author' })
        .published()
        .all()
      expect(posts.map((p) => p.id)).toEqual([POST_A])
    })
  })

  describe('blocks', () => {
    it('withBlock by type matches posts that contain a block of that type', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedBlocks(testDb)
      const posts = await new PostStore(testDb.db).query().withBlock({ type: 'image' }).all()
      expect(posts.map((p) => p.id)).toEqual([POST_B])
    })

    it('withoutBlock excludes posts containing a block of that type', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedBlocks(testDb)
      const posts = await new PostStore(testDb.db).query().withoutBlock({ type: 'text' }).all()
      expect(posts.map((p) => p.id)).toEqual([POST_C])
    })

    it('withAllBlocks requires every spec to match (AND-of-EXISTS)', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedBlocks(testDb)
      const posts = await new PostStore(testDb.db)
        .query()
        .withAllBlocks([{ type: 'image' }, { type: 'text' }])
        .all()
      expect(posts.map((p) => p.id)).toEqual([POST_B])
    })

    it('withAnyBlock matches OR across specs', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedBlocks(testDb)
      const posts = await new PostStore(testDb.db)
        .query()
        .withAnyBlock([{ type: 'image' }, { type: 'text' }])
        .all()
      expect(posts.map((p) => p.id).sort()).toEqual([POST_A, POST_B].sort())
    })

    it('withBlock by id matches the exact block', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      await seedBlocks(testDb)
      const posts = await new PostStore(testDb.db).query().withBlock({ id: 'b-banana-img' }).all()
      expect(posts.map((p) => p.id)).toEqual([POST_B])
    })
  })

  describe('dict', () => {
    it('returns rows keyed by id', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const dict = await new PostStore(testDb.db).query().inCategory({ id: CATEGORY_ID }).dict()
      expect(Object.keys(dict).sort()).toEqual([POST_A, POST_B, POST_C].sort())
      expect(dict[POST_A]?.name).toBe('Apple')
      expect(dict[POST_B]?.name).toBe('Banana')
    })

    it('honors limit/offset like .all()', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const dict = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .limit(1)
        .offset(1)
        .dict()
      expect(Object.keys(dict)).toEqual([POST_B])
    })
  })

  describe('map', () => {
    it('applies a transformation conditionally inside a chain', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const loggedIn = false
      const posts = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .map((q) => (loggedIn ? q : q.published()))
        .all()
      expect(posts.map((p) => p.name)).toEqual(['Apple', 'Cherry'])
    })

    it('is a no-op when the function returns the input query', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const posts = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .map((q) => q)
        .all()
      expect(posts.map((p) => p.name)).toEqual(['Apple', 'Banana', 'Cherry'])
    })
  })

  describe('indexOf', () => {
    it('returns 0 for the first row in the ordered set', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const idx = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .indexOf((q) => q.byShortId(POST_A.slice(-8)))
      expect(idx).toBe(0)
    })

    it('returns 1 for the second row', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const idx = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .indexOf((q) => q.byShortId(POST_B.slice(-8)))
      expect(idx).toBe(1)
    })

    it('returns 2 for the last row', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const idx = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .indexOf((q) => q.byShortId(POST_C.slice(-8)))
      expect(idx).toBe(2)
    })

    it('returns -1 when the anchor row does not exist', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const idx = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .indexOf((q) => q.byShortId('no-such'))
      expect(idx).toBe(-1)
    })

    it('respects scope predicates: anchor outside scope returns its position within scope', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      // only published: Apple(0), Cherry(1) — Banana is draft
      const idx = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .published()
        .indexOf((q) => q.byShortId(POST_C.slice(-8)))
      expect(idx).toBe(1)
    })

    it('works with orderBy name asc', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      // name order: Apple(0), Banana(1), Cherry(2)
      const idx = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .orderBy('name')
        .indexOf((q) => q.byShortId(POST_C.slice(-8)))
      expect(idx).toBe(2)
    })

    it('works with orderBy name desc', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      // name desc: Cherry(0), Banana(1), Apple(2)
      const idx = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .orderBy('name', 'desc')
        .indexOf((q) => q.byShortId(POST_A.slice(-8)))
      expect(idx).toBe(2)
    })

    it('can be used to fetch the next post', async () => {
      using testDb = await createTestDb()
      await seedPosts(testDb)
      const idx = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .indexOf((q) => q.byShortId(POST_A.slice(-8)))
      const next = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .offset(idx + 1)
        .first()
      expect(next?.name).toBe('Banana')
    })
  })
})

describe('PostStore.move', () => {
  it('moves a post to first position within its own category when anchor is null', async () => {
    using testDb = await createTestDb()
    await seedPosts(testDb)
    await seedPostsInCategory2(testDb)
    // Global order before: Apple(1), Banana(2), Cherry(3), Dragon(4), Elderberry(5)
    await new PostStore(testDb.db).move(POST_C, null)
    // Cherry should be first in category 1, but still after nothing from category 2
    const all = await new PostStore(testDb.db).query().all()
    expect(all.map((p) => p.name)).toEqual(['Cherry', 'Apple', 'Banana', 'Dragon', 'Elderberry'])
    const cat1 = await new PostStore(testDb.db).query().inCategory({ id: CATEGORY_ID }).all()
    expect(cat1.map((p) => p.name)).toEqual(['Cherry', 'Apple', 'Banana'])
  })

  it('null moves to category-first even when other categories have lower positions', async () => {
    using testDb = await createTestDb()
    // Category 2 posts have lower positions than category 1
    await seedPostsInCategory2WithLowerPositions(testDb)
    await seedPosts(testDb)
    // Global order: Dragon(-2), Elderberry(-1), Apple(1), Banana(2), Cherry(3)
    await new PostStore(testDb.db).move(POST_C, null)
    // Cherry should be first within category 1 (before Apple), not globally first
    const cat1 = await new PostStore(testDb.db).query().inCategory({ id: CATEGORY_ID }).all()
    expect(cat1.map((p) => p.name)).toEqual(['Cherry', 'Apple', 'Banana'])
    const all = await new PostStore(testDb.db).query().all()
    expect(all[0].name).toBe('Dragon') // Dragon still globally first
  })

  it('moves a post after another in the same category', async () => {
    using testDb = await createTestDb()
    await seedPosts(testDb)
    await new PostStore(testDb.db).move(POST_A, { afterId: POST_C })
    const posts = await new PostStore(testDb.db).query().all()
    expect(posts.map((p) => p.name)).toEqual(['Banana', 'Cherry', 'Apple'])
  })

  it('moves a post after a post in a different category without changing its category', async () => {
    using testDb = await createTestDb()
    await seedPosts(testDb)
    await seedPostsInCategory2(testDb)
    // Global order before: Apple(1), Banana(2), Cherry(3), Dragon(4), Elderberry(5)
    await new PostStore(testDb.db).move(POST_A, { afterId: POST_D })
    // Global order after: Banana, Cherry, Dragon, Apple, Elderberry
    const posts = await new PostStore(testDb.db).query().all()
    expect(posts.map((p) => p.name)).toEqual(['Banana', 'Cherry', 'Dragon', 'Apple', 'Elderberry'])
    // Apple must remain in its original category
    expect(posts.find((p) => p.id === POST_A)?.categoryId).toBe(CATEGORY_ID)
  })

  it('moves a post before another in the same category', async () => {
    using testDb = await createTestDb()
    await seedPosts(testDb)
    await new PostStore(testDb.db).move(POST_C, { beforeId: POST_A })
    const posts = await new PostStore(testDb.db).query().all()
    expect(posts.map((p) => p.name)).toEqual(['Cherry', 'Apple', 'Banana'])
  })

  it('moves a post before a post in a different category without changing its category', async () => {
    using testDb = await createTestDb()
    await seedPosts(testDb)
    await seedPostsInCategory2(testDb)
    // Global order before: Apple(1), Banana(2), Cherry(3), Dragon(4), Elderberry(5)
    await new PostStore(testDb.db).move(POST_E, { beforeId: POST_B })
    // Global order after: Apple, Elderberry, Banana, Cherry, Dragon
    const posts = await new PostStore(testDb.db).query().all()
    expect(posts.map((p) => p.name)).toEqual(['Apple', 'Elderberry', 'Banana', 'Cherry', 'Dragon'])
    // Elderberry must remain in its original category
    expect(posts.find((p) => p.id === POST_E)?.categoryId).toBe(CATEGORY_ID_2)
  })

  it('throws when the post has no parent', async () => {
    using testDb = await createTestDb()
    await expect(new PostStore(testDb.db).move('no-such-post', null)).rejects.toThrow(
      'Post has no parent',
    )
  })

  it('throws when afterId does not exist', async () => {
    using testDb = await createTestDb()
    await seedPosts(testDb)
    await expect(new PostStore(testDb.db).move(POST_A, { afterId: 'no-such-id' })).rejects.toThrow(
      'afterId not found',
    )
  })

  it('throws when beforeId does not exist', async () => {
    using testDb = await createTestDb()
    await seedPosts(testDb)
    await expect(new PostStore(testDb.db).move(POST_A, { beforeId: 'no-such-id' })).rejects.toThrow(
      'beforeId not found',
    )
  })
})

// ─── seed fixtures ───────────────────────────────────────────────────────────

async function seedPosts(testDb: TestDb): Promise<void> {
  await testDb.db
    .insert(category)
    .values({ id: CATEGORY_ID, shortid: CATEGORY_SHORTID, name: 'Birds', slug: 'birds' })
  await insertPost(testDb, POST_A, 'Apple', 'apple', 'published', 1)
  await insertPost(testDb, POST_B, 'Banana', 'banana', 'draft', 2)
  await insertPost(testDb, POST_C, 'Cherry', 'cherry', 'published', 3)
}

async function seedTags(testDb: TestDb): Promise<void> {
  await testDb.db
    .insert(tag)
    .values({ id: TAG_RED, shortid: TAG_RED.slice(-8), name: 'Red', slug: 'red' })
  await testDb.db
    .insert(tag)
    .values({ id: TAG_BLUE, shortid: TAG_BLUE.slice(-8), name: 'Blue', slug: 'blue' })
  // Apple → red, Banana → red+blue, Cherry → blue
  await tagPost(testDb, POST_A, TAG_RED)
  await tagPost(testDb, POST_B, TAG_RED)
  await tagPost(testDb, POST_B, TAG_BLUE)
  await tagPost(testDb, POST_C, TAG_BLUE)
}

async function seedAttributes(testDb: TestDb): Promise<void> {
  // Apple → author=Alice
  // Banana → author=Bob, lang=en
  // Cherry → lang=fr
  await attachAttribute(testDb, 'a-apple-author', POST_A, 'author', 'Alice')
  await attachAttribute(testDb, 'a-banana-author', POST_B, 'author', 'Bob')
  await attachAttribute(testDb, 'a-banana-lang', POST_B, 'lang', 'en')
  await attachAttribute(testDb, 'a-cherry-lang', POST_C, 'lang', 'fr')
}

async function seedBlocks(testDb: TestDb): Promise<void> {
  // Apple → text block "hello"
  // Banana → image block + text block
  // Cherry → (no blocks)
  await attachBlock(testDb, 'b-apple-text', POST_A, {
    type: 'text',
    key: 't1',
    text: 'hello',
  })
  await attachBlock(testDb, 'b-banana-img', POST_B, {
    type: 'image',
    key: 'i1',
    assetId: 'asset-x',
  })
  await attachBlock(testDb, 'b-banana-text', POST_B, {
    type: 'text',
    key: 't2',
    text: 'banana',
  })
}

async function seedPostsInCategory2WithLowerPositions(testDb: TestDb): Promise<void> {
  await testDb.db
    .insert(category)
    .values({ id: CATEGORY_ID_2, shortid: CATEGORY_SHORTID_2, name: 'Fruits', slug: 'fruits' })
  await insertPostInCategory(testDb, POST_D, 'Dragon', 'dragon', 'published', -2, CATEGORY_ID_2)
  await insertPostInCategory(
    testDb,
    POST_E,
    'Elderberry',
    'elderberry',
    'published',
    -1,
    CATEGORY_ID_2,
  )
}

async function seedPostsInCategory2(testDb: TestDb): Promise<void> {
  await testDb.db
    .insert(category)
    .values({ id: CATEGORY_ID_2, shortid: CATEGORY_SHORTID_2, name: 'Fruits', slug: 'fruits' })
  await insertPostInCategory(testDb, POST_D, 'Dragon', 'dragon', 'published', 4, CATEGORY_ID_2)
  await insertPostInCategory(
    testDb,
    POST_E,
    'Elderberry',
    'elderberry',
    'published',
    5,
    CATEGORY_ID_2,
  )
}

async function insertPost(
  testDb: TestDb,
  id: string,
  name: string,
  slug: string,
  status: 'published' | 'draft',
  position: number,
): Promise<void> {
  await insertPostInCategory(testDb, id, name, slug, status, position, CATEGORY_ID)
}

async function insertPostInCategory(
  testDb: TestDb,
  id: string,
  name: string,
  slug: string,
  status: 'published' | 'draft',
  position: number,
  categoryId: string,
): Promise<void> {
  await testDb.db.insert(postTable).values({ id, shortid: id.slice(-8), name, slug, status })
  await testDb.db
    .insert(parentPost)
    .values({ postId: id, parentId: categoryId, parentTable: 'category', position })
}

async function tagPost(testDb: TestDb, postId: string, tagId: string): Promise<void> {
  await testDb.db.insert(parentTag).values({ tagId, parentId: postId, parentTable: 'post' })
}

async function attachAttribute(
  testDb: TestDb,
  attrId: string,
  parentId: string,
  key: string,
  text: string,
): Promise<void> {
  await testDb.db.insert(attribute).values({ id: attrId, key, translatable: 0, text })
  await testDb.db
    .insert(parentAttribute)
    .values({ attributeId: attrId, parentId, parentTable: 'post' })
}

async function attachBlock(
  testDb: TestDb,
  blockId: string,
  postId: string,
  content: object,
): Promise<void> {
  await testDb.db.insert(block).values({ id: blockId, content: JSON.stringify(content) })
  await testDb.db.insert(parentBlock).values({ blockId, parentId: postId, parentTable: 'post' })
}
