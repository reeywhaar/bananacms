import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PostStore } from './PostStore'
import { createTestDb, type TestDb } from '../test/db'
import { post as postTable, parentPost, parentTag, tag, localizations, category } from '@cms/lib/db/schema'

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
    testDb.client.close()
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
})

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
