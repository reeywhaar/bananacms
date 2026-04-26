import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Database } from 'sqlite'
import { PostStore } from './PostStore'
import { InvalidIdentifierError } from './getByParentQuery'
import { createTestDb } from '../test/db'

const CATEGORY_ID = '019dbce5-5aac-763a-ac29-509b1a86750f'
const CATEGORY_SHORTID = '1a86750f'

const POST_A = '019dbcea-d3a4-75e7-b37a-190d5165077a'
const POST_B = '019dbcea-d3a4-75e7-b37a-190d5165077b'
const POST_C = '019dbcea-d3a4-75e7-b37a-190d5165077c'

describe('PostStore.get', () => {
  let db: Database

  beforeEach(async () => {
    db = await createTestDb()
    await db.run(
      'INSERT INTO category (id, shortid, name, slug) VALUES (?, ?, ?, ?)',
      CATEGORY_ID,
      CATEGORY_SHORTID,
      'Birds',
      'birds',
    )
    await insertPost(db, POST_A, 'Apple', 'apple', 'published', 1)
    await insertPost(db, POST_B, 'Banana', 'banana', 'draft', 2)
    await insertPost(db, POST_C, 'Cherry', 'cherry', 'published', 3)
  })

  afterEach(async () => {
    await db.close()
  })

  const inCategory = { type: 'parent', table: 'category', column: 'id', value: CATEGORY_ID } as const

  describe('parent variant', () => {
    it('returns all posts in a category, ordered by parent_post.position', async () => {
      const posts = await new PostStore(db).get(inCategory)
      expect(posts.map((p) => p.name)).toEqual(['Apple', 'Banana', 'Cherry'])
      expect(posts.at(0)?.categoryId).toBe(CATEGORY_ID)
    })

    it('looks up by parent shortid when column = "shortid"', async () => {
      const byId = await new PostStore(db).get(inCategory)
      const byShortId = await new PostStore(db).get({
        type: 'parent',
        table: 'category',
        column: 'shortid',
        value: CATEGORY_SHORTID,
      })
      expect(byShortId.map((p) => p.id)).toEqual(byId.map((p) => p.id))
    })

    it('filters out drafts when status = "published"', async () => {
      const posts = await new PostStore(db).get(inCategory, { status: 'published' })
      expect(posts.map((p) => p.name)).toEqual(['Apple', 'Cherry'])
    })

    it('returns only drafts when status = "draft"', async () => {
      const posts = await new PostStore(db).get(inCategory, { status: 'draft' })
      expect(posts.map((p) => p.name)).toEqual(['Banana'])
    })

    it('coalesces the name field against localizations when locale is set', async () => {
      await db.run(
        "INSERT INTO localizations (id, key, locale, text) VALUES ('l1', ?, 'ru', 'Яблоко')",
        `post:${POST_A}:name`,
      )
      const posts = await new PostStore(db).get(inCategory, { locale: 'ru' })
      const apple = posts.find((p) => p.id === POST_A)
      const banana = posts.find((p) => p.id === POST_B)
      expect(apple?.name).toBe('Яблоко')
      expect(banana?.name).toBe('Banana')
    })

    it('honors custom order field with secondary id tiebreaker', async () => {
      const posts = await new PostStore(db).get(inCategory, {
        order: { field: 'name', order: 'desc' },
      })
      expect(posts.map((p) => p.name)).toEqual(['Cherry', 'Banana', 'Apple'])
    })

    it('applies limit and offset', async () => {
      const page = await new PostStore(db).get(inCategory, { limit: 1, offset: 1 })
      expect(page.map((p) => p.name)).toEqual(['Banana'])
    })

    it('returns [] for an empty value', async () => {
      const posts = await new PostStore(db).get({
        type: 'parent',
        table: 'category',
        column: 'id',
        value: '',
      })
      expect(posts).toEqual([])
    })
  })

  describe('all variant', () => {
    it('returns every post ordered by parent_post.position', async () => {
      const posts = await new PostStore(db).get({ type: 'all' })
      expect(posts.map((p) => p.name)).toEqual(['Apple', 'Banana', 'Cherry'])
    })

    it('coalesces names via locale option', async () => {
      await db.run(
        "INSERT INTO localizations (id, key, locale, text) VALUES ('l1', ?, 'ru', 'Яблоко')",
        `post:${POST_A}:name`,
      )
      const posts = await new PostStore(db).get({ type: 'all' }, { locale: 'ru' })
      expect(posts.find((p) => p.id === POST_A)?.name).toBe('Яблоко')
    })

    it('respects status filter', async () => {
      const posts = await new PostStore(db).get({ type: 'all' }, { status: 'draft' })
      expect(posts.map((p) => p.name)).toEqual(['Banana'])
    })
  })

  describe('column variant', () => {
    it('fetches a single post by id', async () => {
      const post = (
        await new PostStore(db).get({ type: 'column', column: 'id', value: POST_A })
      ).at(0)
      expect(post?.name).toBe('Apple')
    })

    it('fetches by shortid', async () => {
      const post = (
        await new PostStore(db).get({
          type: 'column',
          column: 'shortid',
          value: POST_A.slice(-8),
        })
      ).at(0)
      expect(post?.id).toBe(POST_A)
    })

    it('fetches by slug', async () => {
      const post = (
        await new PostStore(db).get({ type: 'column', column: 'slug', value: 'banana' })
      ).at(0)
      expect(post?.id).toBe(POST_B)
    })

    it('returns [] for an empty value', async () => {
      const posts = await new PostStore(db).get({ type: 'column', column: 'id', value: '' })
      expect(posts).toEqual([])
    })
  })

  describe('parent: tag variant', () => {
    const TAG_RED = '019dbcf0-0000-7000-0000-000000000001'
    const TAG_BLUE = '019dbcf0-0000-7000-0000-000000000002'

    beforeEach(async () => {
      await db.run(
        'INSERT INTO tag (id, shortid, name, slug) VALUES (?, ?, ?, ?)',
        TAG_RED,
        TAG_RED.slice(-8),
        'Red',
        'red',
      )
      await db.run(
        'INSERT INTO tag (id, shortid, name, slug) VALUES (?, ?, ?, ?)',
        TAG_BLUE,
        TAG_BLUE.slice(-8),
        'Blue',
        'blue',
      )
      // Apple → red, Banana → red+blue, Cherry → blue
      await tagPost(db, POST_A, TAG_RED)
      await tagPost(db, POST_B, TAG_RED)
      await tagPost(db, POST_B, TAG_BLUE)
      await tagPost(db, POST_C, TAG_BLUE)
    })

    it('returns posts that have the tag, by tag id', async () => {
      const posts = await new PostStore(db).get({
        type: 'parent',
        table: 'tag',
        column: 'id',
        value: TAG_RED,
      })
      expect(posts.map((p) => p.name)).toEqual(['Apple', 'Banana'])
      expect(posts.at(0)?.categoryId).toBe(CATEGORY_ID)
    })

    it('looks up by tag shortid and slug', async () => {
      const byShortid = await new PostStore(db).get({
        type: 'parent',
        table: 'tag',
        column: 'shortid',
        value: TAG_BLUE.slice(-8),
      })
      const bySlug = await new PostStore(db).get({
        type: 'parent',
        table: 'tag',
        column: 'slug',
        value: 'blue',
      })
      expect(byShortid.map((p) => p.id)).toEqual([POST_B, POST_C])
      expect(bySlug.map((p) => p.id)).toEqual([POST_B, POST_C])
    })

    it('respects status filter', async () => {
      const posts = await new PostStore(db).get(
        { type: 'parent', table: 'tag', column: 'id', value: TAG_RED },
        { status: 'published' },
      )
      expect(posts.map((p) => p.name)).toEqual(['Apple'])
    })

    it('honors order field with id tiebreaker', async () => {
      const posts = await new PostStore(db).get(
        { type: 'parent', table: 'tag', column: 'id', value: TAG_RED },
        { order: { field: 'name', order: 'desc' } },
      )
      expect(posts.map((p) => p.name)).toEqual(['Banana', 'Apple'])
    })

    it('coalesces names against localizations', async () => {
      await db.run(
        "INSERT INTO localizations (id, key, locale, text) VALUES ('l1', ?, 'ru', 'Яблоко')",
        `post:${POST_A}:name`,
      )
      const posts = await new PostStore(db).get(
        { type: 'parent', table: 'tag', column: 'id', value: TAG_RED },
        { locale: 'ru' },
      )
      expect(posts.find((p) => p.id === POST_A)?.name).toBe('Яблоко')
    })

    it('applies limit and offset', async () => {
      const page = await new PostStore(db).get(
        { type: 'parent', table: 'tag', column: 'id', value: TAG_RED },
        { limit: 1, offset: 1 },
      )
      expect(page.map((p) => p.name)).toEqual(['Banana'])
    })

    it('returns [] for an empty value', async () => {
      const posts = await new PostStore(db).get({
        type: 'parent',
        table: 'tag',
        column: 'id',
        value: '',
      })
      expect(posts).toEqual([])
    })
  })

  describe('validation', () => {
    it('throws InvalidIdentifierError for an unknown parent column', async () => {
      await expect(
        new PostStore(db).get({
          type: 'parent',
          table: 'category',
          // @ts-expect-error — runtime check kicks in even when types are bypassed
          column: 'name',
          value: CATEGORY_ID,
        }),
      ).rejects.toThrow(InvalidIdentifierError)
    })

    it('throws InvalidIdentifierError for an unknown order.field', async () => {
      await expect(
        new PostStore(db).get(inCategory, {
          // @ts-expect-error — runtime check
          order: { field: 'bogus', order: 'asc' },
        }),
      ).rejects.toThrow(InvalidIdentifierError)
    })

    it('throws InvalidIdentifierError for an unknown query type', async () => {
      await expect(
        // @ts-expect-error — runtime check
        new PostStore(db).get({ type: 'bogus' }),
      ).rejects.toThrow(InvalidIdentifierError)
    })
  })
})

async function insertPost(
  db: Database,
  id: string,
  name: string,
  slug: string,
  status: 'published' | 'draft',
  position: number,
): Promise<void> {
  await db.run(
    'INSERT INTO post (id, shortid, name, slug, status) VALUES (?, ?, ?, ?, ?)',
    id,
    id.slice(-8),
    name,
    slug,
    status,
  )
  await db.run(
    'INSERT INTO parent_post (postId, parentId, parentTable, position) VALUES (?, ?, ?, ?)',
    id,
    CATEGORY_ID,
    'category',
    position,
  )
}

async function tagPost(db: Database, postId: string, tagId: string): Promise<void> {
  await db.run(
    'INSERT INTO parent_tag (tagId, parentId, parentTable) VALUES (?, ?, ?)',
    tagId,
    postId,
    'post',
  )
}
