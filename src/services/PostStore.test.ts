import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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

describe('PostStore.query', () => {
  let testDb: TestDb

  beforeEach(async () => {
    testDb = await createTestDb()
    await testDb.db
      .insert(category)
      .values({ id: CATEGORY_ID, shortid: CATEGORY_SHORTID, name: 'Birds', slug: 'birds' })
      .run()
    await insertPost(testDb, POST_A, 'Apple', 'apple', 'published', 1)
    await insertPost(testDb, POST_B, 'Banana', 'banana', 'draft', 2)
    await insertPost(testDb, POST_C, 'Cherry', 'cherry', 'published', 3)
  })

  afterEach(async () => {
    testDb.close()
  })

  describe('inCategory', () => {
    it('returns all posts in a category, ordered by parent_post.position', async () => {
      const posts = await new PostStore(testDb.db).query().inCategory({ id: CATEGORY_ID }).all()
      expect(posts.map((p) => p.name)).toEqual(['Apple', 'Banana', 'Cherry'])
      expect(posts.at(0)?.categoryId).toBe(CATEGORY_ID)
    })

    it('looks up by category slug', async () => {
      const byId = await new PostStore(testDb.db).query().inCategory({ id: CATEGORY_ID }).all()
      const bySlug = await new PostStore(testDb.db).query().inCategory({ slug: 'birds' }).all()
      expect(bySlug.map((p) => p.id)).toEqual(byId.map((p) => p.id))
    })

    it('inCategory({ ids }) matches any of the listed categories', async () => {
      // CATEGORY_ID is the only category seeded; pass it via ids.
      const posts = await new PostStore(testDb.db)
        .query()
        .inCategory({ ids: [CATEGORY_ID, 'no-such-cat'] })
        .all()
      expect(posts.map((p) => p.name)).toEqual(['Apple', 'Banana', 'Cherry'])
    })

    it('inCategory({ ids: [] }) returns no posts', async () => {
      const posts = await new PostStore(testDb.db).query().inCategory({ ids: [] }).all()
      expect(posts).toEqual([])
    })

    it('filters out drafts when .published()', async () => {
      const posts = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .published()
        .all()
      expect(posts.map((p) => p.name)).toEqual(['Apple', 'Cherry'])
    })

    it('returns only drafts when .draft()', async () => {
      const posts = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .draft()
        .all()
      expect(posts.map((p) => p.name)).toEqual(['Banana'])
    })

    it('coalesces the name field against localizations when locale is set', async () => {
      await testDb.db
        .insert(localizations)
        .values({ id: 'l1', key: `post:${POST_A}:name`, locale: 'ru', text: 'Яблоко' })
        .run()
      const posts = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .locale('ru')
        .all()
      const apple = posts.find((p) => p.id === POST_A)
      const banana = posts.find((p) => p.id === POST_B)
      expect(apple?.name).toBe('Яблоко')
      expect(banana?.name).toBe('Banana')
    })

    it('honors custom order field with secondary id tiebreaker', async () => {
      const posts = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .orderBy('name', 'desc')
        .all()
      expect(posts.map((p) => p.name)).toEqual(['Cherry', 'Banana', 'Apple'])
    })

    it('applies limit and offset', async () => {
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
      const posts = await new PostStore(testDb.db).query().all()
      expect(posts.map((p) => p.name)).toEqual(['Apple', 'Banana', 'Cherry'])
    })

    it('coalesces names via locale', async () => {
      await testDb.db
        .insert(localizations)
        .values({ id: 'l1', key: `post:${POST_A}:name`, locale: 'ru', text: 'Яблоко' })
        .run()
      const posts = await new PostStore(testDb.db).query().locale('ru').all()
      expect(posts.find((p) => p.id === POST_A)?.name).toBe('Яблоко')
    })

    it('respects status filter', async () => {
      const posts = await new PostStore(testDb.db).query().draft().all()
      expect(posts.map((p) => p.name)).toEqual(['Banana'])
    })
  })

  describe('column', () => {
    it('byId fetches a single post', async () => {
      const post = await new PostStore(testDb.db).query().byId(POST_A).first()
      expect(post?.name).toBe('Apple')
    })

    it('byShortId fetches a single post', async () => {
      const post = await new PostStore(testDb.db).query().byShortId(POST_A.slice(-8)).first()
      expect(post?.id).toBe(POST_A)
    })

    it('bySlug fetches a single post', async () => {
      const post = await new PostStore(testDb.db).query().bySlug('banana').first()
      expect(post?.id).toBe(POST_B)
    })
  })

  describe('tags', () => {
    const TAG_RED = '019dbcf0-0000-7000-0000-000000000001'
    const TAG_BLUE = '019dbcf0-0000-7000-0000-000000000002'

    beforeEach(async () => {
      await testDb.db
        .insert(tag)
        .values({ id: TAG_RED, shortid: TAG_RED.slice(-8), name: 'Red', slug: 'red' })
        .run()
      await testDb.db
        .insert(tag)
        .values({ id: TAG_BLUE, shortid: TAG_BLUE.slice(-8), name: 'Blue', slug: 'blue' })
        .run()
      // Apple → red, Banana → red+blue, Cherry → blue
      tagPost(testDb, POST_A, TAG_RED)
      tagPost(testDb, POST_B, TAG_RED)
      tagPost(testDb, POST_B, TAG_BLUE)
      tagPost(testDb, POST_C, TAG_BLUE)
    })

    it('withTag by id returns posts that have the tag', async () => {
      const posts = await new PostStore(testDb.db).query().withTag({ id: TAG_RED }).all()
      expect(posts.map((p) => p.name)).toEqual(['Apple', 'Banana'])
      expect(posts.at(0)?.categoryId).toBe(CATEGORY_ID)
    })

    it('withTag by shortid and slug', async () => {
      const byShortid = await new PostStore(testDb.db)
        .query()
        .withTag({ shortid: TAG_BLUE.slice(-8) })
        .all()
      const bySlug = await new PostStore(testDb.db).query().withTag({ slug: 'blue' }).all()
      expect(byShortid.map((p) => p.id)).toEqual([POST_B, POST_C])
      expect(bySlug.map((p) => p.id)).toEqual([POST_B, POST_C])
    })

    it('withoutTag excludes posts that have that tag', async () => {
      // Posts without the 'red' tag → only Cherry
      const posts = await new PostStore(testDb.db).query().withoutTag({ slug: 'red' }).all()
      expect(posts.map((p) => p.name)).toEqual(['Cherry'])
    })

    it('respects status filter', async () => {
      const posts = await new PostStore(testDb.db)
        .query()
        .withTag({ id: TAG_RED })
        .published()
        .all()
      expect(posts.map((p) => p.name)).toEqual(['Apple'])
    })

    it('honors order field', async () => {
      const posts = await new PostStore(testDb.db)
        .query()
        .withTag({ id: TAG_RED })
        .orderBy('name', 'desc')
        .all()
      expect(posts.map((p) => p.name)).toEqual(['Banana', 'Apple'])
    })

    it('coalesces names against localizations', async () => {
      await testDb.db
        .insert(localizations)
        .values({ id: 'l1', key: `post:${POST_A}:name`, locale: 'ru', text: 'Яблоко' })
        .run()
      const posts = await new PostStore(testDb.db)
        .query()
        .withTag({ id: TAG_RED })
        .locale('ru')
        .all()
      expect(posts.find((p) => p.id === POST_A)?.name).toBe('Яблоко')
    })

    it('applies limit and offset', async () => {
      const page = await new PostStore(testDb.db)
        .query()
        .withTag({ id: TAG_RED })
        .limit(1)
        .offset(1)
        .all()
      expect(page.map((p) => p.name)).toEqual(['Banana'])
    })

    it('withAnyTag matches OR across specs', async () => {
      const posts = await new PostStore(testDb.db)
        .query()
        .withAnyTag([{ slug: 'red' }, { slug: 'blue' }])
        .all()
      expect(posts.map((p) => p.id).sort()).toEqual([POST_A, POST_B, POST_C].sort())
    })
  })

  describe('attributes', () => {
    beforeEach(async () => {
      // Apple → author=Alice
      // Banana → author=Bob, lang=en
      // Cherry → lang=fr
      await attachAttribute(testDb, 'a-apple-author', POST_A, 'author', 'Alice')
      await attachAttribute(testDb, 'a-banana-author', POST_B, 'author', 'Bob')
      await attachAttribute(testDb, 'a-banana-lang', POST_B, 'lang', 'en')
      await attachAttribute(testDb, 'a-cherry-lang', POST_C, 'lang', 'fr')
    })

    it('withAttribute by key matches posts with that key (any value)', async () => {
      const posts = await new PostStore(testDb.db)
        .query()
        .withAttribute({ key: 'author' })
        .all()
      expect(posts.map((p) => p.id).sort()).toEqual([POST_A, POST_B].sort())
    })

    it('withAttribute by key + value matches exact text', async () => {
      const posts = await new PostStore(testDb.db)
        .query()
        .withAttribute({ key: 'author', value: 'Alice' })
        .all()
      expect(posts.map((p) => p.id)).toEqual([POST_A])
    })

    it('withAttribute by key + valueLike matches LIKE pattern', async () => {
      const posts = await new PostStore(testDb.db)
        .query()
        .withAttribute({ key: 'lang', valueLike: 'e%' })
        .all()
      expect(posts.map((p) => p.id)).toEqual([POST_B])
    })

    it('withoutAttribute excludes posts with that key', async () => {
      const posts = await new PostStore(testDb.db)
        .query()
        .withoutAttribute({ key: 'lang' })
        .all()
      expect(posts.map((p) => p.id)).toEqual([POST_A])
    })

    it('withoutAttribute by key + value only excludes exact matches', async () => {
      const posts = await new PostStore(testDb.db)
        .query()
        .withoutAttribute({ key: 'author', value: 'Alice' })
        .all()
      expect(posts.map((p) => p.id).sort()).toEqual([POST_B, POST_C].sort())
    })

    it('withAnyAttribute matches OR across specs', async () => {
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
      const posts = await new PostStore(testDb.db)
        .query()
        .withAttribute({ key: 'author' })
        .published()
        .all()
      expect(posts.map((p) => p.id)).toEqual([POST_A])
    })
  })

  describe('blocks', () => {
    beforeEach(async () => {
      // Apple → text block "hello"
      // Banana → image block + text block
      // Cherry → (no blocks)
      await attachBlock(testDb, 'b-apple-text', POST_A, 'text', {
        type: 'text',
        key: 't1',
        text: 'hello',
      })
      await attachBlock(testDb, 'b-banana-img', POST_B, 'image', {
        type: 'image',
        key: 'i1',
        assetId: 'asset-x',
      })
      await attachBlock(testDb, 'b-banana-text', POST_B, 'text', {
        type: 'text',
        key: 't2',
        text: 'banana',
      })
    })

    it('withBlock by type matches posts that contain a block of that type', async () => {
      const posts = await new PostStore(testDb.db)
        .query()
        .withBlock({ type: 'image' })
        .all()
      expect(posts.map((p) => p.id)).toEqual([POST_B])
    })

    it('withoutBlock excludes posts containing a block of that type', async () => {
      const posts = await new PostStore(testDb.db)
        .query()
        .withoutBlock({ type: 'text' })
        .all()
      expect(posts.map((p) => p.id)).toEqual([POST_C])
    })

    it('withAllBlocks requires every spec to match (AND-of-EXISTS)', async () => {
      const posts = await new PostStore(testDb.db)
        .query()
        .withAllBlocks([{ type: 'image' }, { type: 'text' }])
        .all()
      expect(posts.map((p) => p.id)).toEqual([POST_B])
    })

    it('withAnyBlock matches OR across specs', async () => {
      const posts = await new PostStore(testDb.db)
        .query()
        .withAnyBlock([{ type: 'image' }, { type: 'text' }])
        .all()
      expect(posts.map((p) => p.id).sort()).toEqual([POST_A, POST_B].sort())
    })

    it('withBlock by id matches the exact block', async () => {
      const posts = await new PostStore(testDb.db)
        .query()
        .withBlock({ id: 'b-banana-img' })
        .all()
      expect(posts.map((p) => p.id)).toEqual([POST_B])
    })
  })

  describe('dict', () => {
    it('returns rows keyed by id', async () => {
      const dict = await new PostStore(testDb.db).query().inCategory({ id: CATEGORY_ID }).dict()
      expect(Object.keys(dict).sort()).toEqual([POST_A, POST_B, POST_C].sort())
      expect(dict[POST_A]?.name).toBe('Apple')
      expect(dict[POST_B]?.name).toBe('Banana')
    })

    it('honors limit/offset like .all()', async () => {
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
      const loggedIn = false
      const posts = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .map((q) => (loggedIn ? q : q.published()))
        .all()
      expect(posts.map((p) => p.name)).toEqual(['Apple', 'Cherry'])
    })

    it('is a no-op when the function returns the input query', async () => {
      const posts = await new PostStore(testDb.db)
        .query()
        .inCategory({ id: CATEGORY_ID })
        .map((q) => q)
        .all()
      expect(posts.map((p) => p.name)).toEqual(['Apple', 'Banana', 'Cherry'])
    })
  })
})

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
  type: string,
  content: object,
): Promise<void> {
  await testDb.db.insert(block).values({ id: blockId, type, content: JSON.stringify(content) })
  await testDb.db
    .insert(parentBlock)
    .values({ blockId, parentId: postId, parentTable: 'post' })
}

async function insertPost(
  testDb: TestDb,
  id: string,
  name: string,
  slug: string,
  status: 'published' | 'draft',
  position: number,
): Promise<void> {
  await testDb.db
    .insert(postTable)
    .values({ id, shortid: id.slice(-8), name, slug, status })
    .run()
  await testDb.db
    .insert(parentPost)
    .values({ postId: id, parentId: CATEGORY_ID, parentTable: 'category', position })
    .run()
}

async function tagPost(testDb: TestDb, postId: string, tagId: string): Promise<void> {
  await testDb.db
    .insert(parentTag)
    .values({ tagId, parentId: postId, parentTable: 'post' })
    .run()
}
