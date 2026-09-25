import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import type { BlockData } from '@reeywhaar/bananacms'
import {
  AssetStore,
  AttributeStore,
  BlockStore,
  CategoryStore,
  LocalizationStore,
  openDatabases,
  PageStore,
  PostStore,
  TagStore,
  UserStore,
  type AttributeData,
  type Translations,
} from '@reeywhaar/bananacms/stores'
import { siteCli } from '../../cms/test/cli.ts'
import {
  defaultLocale,
  locales,
  type Attributes,
  type Block,
  type Localized,
  type Seed,
} from '../seed/content.ts'
import seed from '../seed/index.ts'
import { cms } from '../src/cms.ts'
import { demoRoot, seedDemo } from './seeded.ts'

// The seed as CI checks it: `npm run seed` into a throwaway DATA_PATH has to leave
// databases the migrations make, holding the content in seed/ as it's written
// there. A migration or a store change that leaves the seed behind fails here.

const root = demoRoot
const { runCli } = siteCli(root)
const dataPath = mkdtempSync(path.join(tmpdir(), 'bananacms-seed-'))

beforeAll(() => seedDemo(dataPath))

afterAll(() => rmSync(dataPath, { recursive: true, force: true }))

it('leaves databases the migrations make', async () => {
  const { stdout } = await runCli(['db', 'migration', 'check'], dataPath)
  expect(stdout).toMatch(/the databases are what the \d+ migrations make/)
})

it('holds the content as seed/ has it', async () => {
  vi.stubEnv('DATA_PATH', dataPath)
  try {
    using databases = await openDatabases(root)
    expect(await readBack(databases.db)).toEqual(normalized(seed))
  } finally {
    vi.unstubAllEnvs()
  }
})

it('has the demo user', async () => {
  vi.stubEnv('DATA_PATH', dataPath)
  try {
    using databases = await openDatabases(root)
    expect(await new UserStore(databases.db).findByName('demo')).toBeDefined()
  } finally {
    vi.unstubAllEnvs()
  }
})

it('is written in the languages the site has', () => {
  expect(cms.locales.default).toBe(defaultLocale)
  expect(cms.locales.locales.map((locale) => locale.code)).toEqual([...locales])
})

// The seed with its defaults filled in and its lists in a set order, as readBack
// gives the database
function normalized({ tags, categories, pages }: Seed) {
  const blocks = (list: Block[] = []): Block[] =>
    list.map((block) =>
      block.type === 'group'
        ? { ...block, blocks: blocks(block.blocks), attributes: block.attributes ?? {} }
        : { ...block, attributes: block.attributes ?? {} },
    )
  return {
    tags: tags
      .map((tag) => ({
        slug: tag.slug,
        name: tag.name,
        blocks: blocks(tag.blocks),
        attributes: tag.attributes ?? {},
      }))
      .toSorted(bySlug),
    categories: categories
      .map((category) => ({
        slug: category.slug,
        name: category.name,
        blocks: blocks(category.blocks),
        attributes: category.attributes ?? {},
        posts: category.posts.map((post) => ({
          slug: post.slug,
          name: post.name,
          status: post.status ?? 'published',
          tags: (post.tags ?? []).map((tag) => tag.slug).toSorted(),
          blocks: blocks(post.blocks),
          attributes: post.attributes ?? {},
        })),
      }))
      .toSorted(bySlug),
    pages: pages
      .map((page) => ({
        key: page.key,
        blocks: blocks(page.blocks),
        attributes: page.attributes ?? {},
      }))
      .toSorted((a, b) => a.key.localeCompare(b.key)),
  }
}

// What the database holds, in the seed's own terms: texts in each language, and
// files by their path in seed/files, found by their content
async function readBack(db: Awaited<ReturnType<typeof openDatabases>>['db']) {
  const filesDir = path.join(root, 'seed/files')
  const byHash = new Map(
    readdirSync(filesDir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
      .map((entry) => {
        const file = path.join(entry.parentPath, entry.name)
        return [sha256(readFileSync(file)), path.relative(filesDir, file).split(path.sep).join('/')]
      }),
  )
  const fileOf = async (assetId: string) => {
    const asset = await new AssetStore(db).get(assetId)
    return asset ? (byHash.get(sha256(asset.data)) ?? `unknown: ${asset.filename}`) : 'missing'
  }
  const localized = (translations: Translations, key: string, text: string): Localized => {
    const values = {} as Localized
    for (const locale of locales) {
      values[locale] = locale === defaultLocale ? text : (translations[locale]?.[key] ?? '')
    }
    return values
  }
  const attributesOf = (list: AttributeData[], translations: Translations): Attributes =>
    Object.fromEntries(
      list.map((attribute) => [
        attribute.key,
        attribute.translatable
          ? localized(translations, `attribute:${attribute.id}:text`, attribute.text)
          : attribute.text,
      ]),
    )
  const toBlock = async (block: BlockData, translations: Translations): Promise<Block> => {
    const { content } = block
    const attributes = attributesOf(block.attributes, translations)
    switch (content.type) {
      case 'text':
        return {
          type: 'text',
          key: content.key,
          contentType: content.contentType,
          text: localized(translations, `block:${block.id}:text`, content.text),
          attributes,
        }
      case 'image':
        return {
          type: 'image',
          key: content.key,
          file: await fileOf(content.assetId),
          alt: localized(translations, `block:${block.id}:alt`, content.alt),
          attributes,
        }
      case 'asset':
        return {
          type: 'asset',
          key: content.key,
          file: await fileOf(content.assetId),
          name: content.name,
          attributes,
        }
      case 'meta':
        return { type: 'meta', key: content.key, text: content.text, attributes }
      case 'group':
        return {
          type: 'group',
          key: content.key,
          blocks: await Promise.all(content.blocks.map((child) => toBlock(child, translations))),
          attributes,
        }
    }
  }
  const entity = async (table: 'tag' | 'category' | 'post' | 'page', id: string, name: string) => {
    const [blocks, attributes, translations] = await Promise.all([
      new BlockStore(db).query().parentedBy({ table, id }).all(),
      new AttributeStore(db).query().parentedBy({ table, id }).all(),
      new LocalizationStore(db).getByParentId(table, id),
    ])
    return {
      name: localized(translations, `${table}:${id}:name`, name),
      blocks: await Promise.all(blocks.map((block) => toBlock(block, translations))),
      attributes: attributesOf(attributes, translations),
    }
  }

  const tags = await new TagStore(db).query().all()
  const tagSlugs = new Map(tags.map((tag) => [tag.id, tag.slug]))
  return {
    tags: (
      await Promise.all(
        tags.map(async (tag) => ({ slug: tag.slug, ...(await entity('tag', tag.id, tag.name)) })),
      )
    ).toSorted(bySlug),
    categories: (
      await Promise.all(
        (await new CategoryStore(db).query().all()).map(async (category) => {
          const posts = await new PostStore(db).query().inCategory({ id: category.id }).all()
          return {
            slug: category.slug,
            ...(await entity('category', category.id, category.name)),
            posts: await Promise.all(
              posts.map(async (post) => {
                const { name, blocks, attributes } = await entity('post', post.id, post.name)
                const tagged = await new TagStore(db)
                  .query()
                  .taggedTo({ table: 'post', id: post.id })
                  .all()
                return {
                  slug: post.slug,
                  name,
                  status: post.status,
                  tags: tagged.map((tag) => tagSlugs.get(tag.id) ?? tag.id).toSorted(),
                  blocks,
                  attributes,
                }
              }),
            ),
          }
        }),
      )
    ).toSorted(bySlug),
    pages: (
      await Promise.all(
        (await new PageStore(db).query().all()).map(async (page) => {
          const { blocks, attributes } = await entity('page', page.id, page.name)
          return { key: page.key, blocks, attributes }
        }),
      )
    ).toSorted((a, b) => a.key.localeCompare(b.key)),
  }
}

function bySlug(a: { slug: string }, b: { slug: string }): number {
  return a.slug.localeCompare(b.slug)
}

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}
