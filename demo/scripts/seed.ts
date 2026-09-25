import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { BlockData, BlockParent } from '@reeywhaar/bananacms'
import {
  AssetStore,
  CategoryStore,
  hashUserPassword,
  openDatabases,
  PageStore,
  PostSearchStore,
  PostStore,
  TagStore,
  UserStore,
  type AssetContent,
  type AttributeData,
  type Translations,
} from '@reeywhaar/bananacms/stores'
import {
  defaultLocale,
  locales,
  type Attributes,
  type Block,
  type Localized,
} from '../seed/content.ts'
import seed from '../seed/index.ts'

// `npm run seed`: the demo's databases, made again from seed/. The databases in
// DATA_PATH, their snapshots and ASSETS_DIRECTORY go; `bananacms db migration
// run` makes new ones; and the content goes in through the CMS's stores, as the
// admin writes it, with the user demo, whose password is demo.

const root = path.resolve(import.meta.dirname, '..')
const filesDir = path.join(root, 'seed/files')
// DATA_PATH from outside .env, like the tests' throwaway ones
const ownDataPath = process.env.DATA_PATH !== undefined
try {
  process.loadEnvFile(path.join(root, '.env'))
} catch {}

const DEMO_USER = { name: 'demo', password: 'demo' }

// the kinds of file seed/files can hold
const MIME_TYPES: Record<string, string> = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

if (!ownDataPath) refuseWhileRunning()
removeData()
execFileSync('bananacms', ['db', 'migration', 'run'], { cwd: root, stdio: 'inherit' })
checkFiles()

using databases = await openDatabases(root)
const { db } = databases
// each file's asset id, once it's stored
const assetIds = new Map<string, string>()
// each tag's id, by slug, for the posts tagged with it
const tagIds = new Map<string, string>()

for (const tag of seed.tags) {
  const id = randomUUID()
  tagIds.set(tag.slug, id)
  await addFiles(tag.blocks)
  await new TagStore(db).add(id, { slug: tag.slug, ...content('tag', id, tag) })
}
for (const category of seed.categories) {
  const id = randomUUID()
  await addFiles(category.blocks)
  await new CategoryStore(db).add(id, { slug: category.slug, ...content('category', id, category) })
  // a post goes on top of those before it
  for (const post of category.posts.toReversed()) {
    const postId = randomUUID()
    await addFiles(post.blocks)
    await new PostStore(db).add(postId, {
      slug: post.slug,
      categoryId: id,
      status: post.status ?? 'published',
      tagIds: (post.tags ?? []).map((tag) => tagIds.get(tag.slug)!),
      ...content('post', postId, post),
    })
    await new PostSearchStore(db).rebuildPostIndex(postId)
  }
}
for (const page of seed.pages) {
  const id = randomUUID()
  await addFiles(page.blocks)
  const { blocks, translations, attributes } = content('page', id, page)
  await new PageStore(db).add(id, { key: page.key, blocks, translations, attributes })
}
await new UserStore(db).create(DEMO_USER.name, await hashUserPassword(DEMO_USER.password))

const posts = seed.categories.reduce((sum, category) => sum + category.posts.length, 0)
console.info(
  `seed: ${seed.categories.length} categories, ${posts} posts, ${seed.tags.length} tags, ${seed.pages.length} pages and ${assetIds.size} files, and the user ${DEMO_USER.name}, password ${DEMO_USER.password}`,
)

// The fields every entity has, as the stores take them: its name, blocks and
// attributes in the default locale, and the rest as translations
function content(
  table: 'tag' | 'category' | 'post' | 'page',
  id: string,
  entity: { name?: Localized; blocks?: Block[]; attributes?: Attributes },
) {
  const translations: Translations = {}
  const translate = (key: string, values: Localized) => {
    for (const locale of locales) {
      if (locale !== defaultLocale) (translations[locale] ??= {})[key] = values[locale]
    }
  }
  if (entity.name) translate(`${table}:${id}:name`, entity.name)
  return {
    name: entity.name?.[defaultLocale] ?? '',
    attributes: toAttributes(entity.attributes, translate),
    blocks: (entity.blocks ?? []).map((block) => toBlock(block, { type: table, id }, translate)),
    translations,
  }
}

type Translate = (key: string, values: Localized) => void

function toAttributes(attributes: Attributes | undefined, translate: Translate): AttributeData[] {
  return Object.entries(attributes ?? {}).map(([key, value]) => {
    const id = randomUUID()
    if (typeof value === 'string') return { id, key, translatable: false, text: value }
    translate(`attribute:${id}:text`, value)
    return { id, key, translatable: true, text: value[defaultLocale] }
  })
}

function toBlock(block: Block, parent: BlockParent, translate: Translate): BlockData {
  const id = randomUUID()
  const attributes = toAttributes(block.attributes, translate)
  switch (block.type) {
    case 'text':
      translate(`block:${id}:text`, block.text)
      return {
        id,
        parent,
        attributes,
        content: {
          type: 'text',
          key: block.key,
          contentType: block.contentType,
          text: block.text[defaultLocale],
        },
      }
    case 'image':
      translate(`block:${id}:alt`, block.alt)
      return {
        id,
        parent,
        attributes,
        content: {
          type: 'image',
          key: block.key,
          name: path.basename(block.file),
          alt: block.alt[defaultLocale],
          assetId: assetIds.get(block.file)!,
        },
      }
    case 'asset':
      return {
        id,
        parent,
        attributes,
        content: {
          type: 'asset',
          key: block.key,
          name: block.name,
          assetId: assetIds.get(block.file)!,
        },
      }
    case 'meta':
      return { id, parent, attributes, content: { type: 'meta', key: block.key, text: block.text } }
    case 'group':
      return {
        id,
        parent,
        attributes,
        content: {
          type: 'group',
          key: block.key,
          blocks: block.blocks.map((child) => toBlock(child, { type: 'block', id }, translate)),
        },
      }
  }
}

// Stores the files the blocks name that aren't stored yet. Each goes in just
// before the blocks that name it: a block save deletes the assets no block names.
async function addFiles(blocks: Block[] = []): Promise<void> {
  for (const file of filesOf(blocks)) {
    if (assetIds.has(file)) continue
    const id = randomUUID()
    const data = await readFile(path.join(filesDir, file))
    const mime = mimeOf(file)
    await new AssetStore(db).add(id, {
      filename: path.basename(file),
      mime,
      data,
      content: mime.startsWith('image/') ? await imageContent(data) : { type: 'file' },
    })
    assetIds.set(file, id)
  }
}

// As the admin's upload has it, the image as it is. One 1200 pixels wide or more
// is made for screens with two pixels to the point, so the site gets a variant
// half its size for the others.
async function imageContent(data: Buffer): Promise<AssetContent> {
  const meta = await sharp(data).metadata()
  const width = meta.autoOrient?.width ?? meta.width
  return {
    type: 'image',
    resolution: width >= 1200 ? '@2x' : '@1x',
    output_as: { type: 'original' },
    width,
    height: meta.autoOrient?.height ?? meta.height,
  }
}

function* filesOf(blocks: Block[]): Generator<string> {
  for (const block of blocks) {
    if (block.type === 'image' || block.type === 'asset') yield block.file
    if (block.type === 'group') yield* filesOf(block.blocks)
  }
}

// every file the content names is in seed/files, and every file there is named
function checkFiles(): void {
  const named = new Set(
    [
      ...seed.tags,
      ...seed.categories,
      ...seed.categories.flatMap((category) => category.posts),
      ...seed.pages,
    ].flatMap((entity) => [...filesOf(entity.blocks ?? [])]),
  )
  const present = new Set(
    readdirSync(filesDir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
      .map((entry) => path.relative(filesDir, path.join(entry.parentPath, entry.name)))
      .map((file) => file.split(path.sep).join('/')),
  )
  for (const file of named) {
    if (!present.has(file)) throw new Error(`seed: no seed/files/${file}`)
    mimeOf(file)
  }
  for (const file of present) {
    if (!named.has(file)) throw new Error(`seed: seed/files/${file} is in no block`)
  }
}

function mimeOf(file: string): string {
  const mime = MIME_TYPES[path.extname(file).toLowerCase()]
  if (!mime)
    throw new Error(`seed: seed/files/${file} isn't one of ${Object.keys(MIME_TYPES).join(', ')}`)
  return mime
}

// A running demo has the databases in .env's DATA_PATH open: `bananacms dev`
// and `start` keep their pid in .pid while they run
function refuseWhileRunning(): void {
  let pid: number
  try {
    pid = Number.parseInt(readFileSync(path.join(root, '.pid'), 'utf8'), 10)
  } catch {
    return
  }
  try {
    process.kill(pid, 0)
  } catch {
    return
  }
  throw new Error(`seed: the demo is running (pid ${pid}); stop it first`)
}

// the demo's databases, their snapshots, and the asset cache
function removeData(): void {
  if (!process.env.DATA_PATH) throw new Error('seed: DATA_PATH is not set (demo/.env)')
  const data = path.resolve(root, process.env.DATA_PATH)
  const assets = process.env.ASSETS_DIRECTORY && path.resolve(root, process.env.ASSETS_DIRECTORY)
  for (const dir of [data, assets]) {
    if (dir && (dir === root || root.startsWith(dir + path.sep))) {
      throw new Error(
        `seed: ${dir} holds the demo itself; point DATA_PATH and ASSETS_DIRECTORY elsewhere`,
      )
    }
  }
  for (const name of ['database.db', 'derived.db']) {
    for (const suffix of ['', '-wal', '-shm'])
      rmSync(path.join(data, name + suffix), { force: true })
  }
  rmSync(path.join(data, 'snapshots'), { recursive: true, force: true })
  if (assets) rmSync(assets, { recursive: true, force: true })
}
