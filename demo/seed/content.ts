import { credits } from './credits.ts'

// The demo's content is TypeScript: each post, tag, category and page is an
// object these functions make, so the compiler checks it, and scripts/seed.ts
// writes it all into a new database. seed/README.md says how to add to it.

export const locales = ['en', 'fr', 'es'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

// a text in each of the demo's languages
export type Localized = Record<Locale, string>

// attributes by key: a value the same in every language, or one for each
export type Attributes = Record<string, string | Localized>

export type Block =
  | {
      type: 'text'
      key: string
      contentType: 'plain' | 'markdown' | 'html'
      text: Localized
      attributes?: Attributes
    }
  | { type: 'image'; key: string; file: string; alt: Localized; attributes?: Attributes }
  | { type: 'asset'; key: string; file: string; name: string; attributes?: Attributes }
  | { type: 'meta'; key: string; text: string; attributes?: Attributes }
  | { type: 'group'; key: string; blocks: Block[]; attributes?: Attributes }

export type Tag = { slug: string; name: Localized; blocks?: Block[]; attributes?: Attributes }

export type Post = {
  slug: string
  name: Localized
  status?: 'published' | 'draft'
  tags?: Tag[]
  attributes?: Attributes
  blocks: Block[]
}

// its posts in the order the site lists them
export type Category = {
  slug: string
  name: Localized
  posts: Post[]
  blocks?: Block[]
  attributes?: Attributes
}

export type Page = { key: string; blocks: Block[]; attributes?: Attributes }

export type Seed = { tags: Tag[]; categories: Category[]; pages: Page[] }

export const tag = (slug: string, fields: Omit<Tag, 'slug'>): Tag => ({ slug, ...fields })
export const post = (slug: string, fields: Omit<Post, 'slug'>): Post => ({ slug, ...fields })
export const category = (slug: string, fields: Omit<Category, 'slug'>): Category => ({
  slug,
  ...fields,
})
export const page = (key: string, fields: Omit<Page, 'key'>): Page => ({ key, ...fields })

// Blocks. A `file` is a path in seed/files/.
export const text = (key: string, text: Localized, attributes?: Attributes): Block => ({
  type: 'text',
  key,
  contentType: 'plain',
  text,
  attributes,
})
export const markdown = (key: string, text: Localized, attributes?: Attributes): Block => ({
  type: 'text',
  key,
  contentType: 'markdown',
  text,
  attributes,
})
export const html = (key: string, text: Localized, attributes?: Attributes): Block => ({
  type: 'text',
  key,
  contentType: 'html',
  text,
  attributes,
})
// An image, credited with its author and source from credits.ts: the attributes
// credit, creditUrl, source, sourceUrl and license
export const image = (
  key: string,
  file: string,
  alt: Localized,
  attributes?: Attributes,
): Block => {
  const credit = credits[file]
  if (!credit) throw new Error(`seed: seed/files/${file} has no credit in seed/credits.ts`)
  return {
    type: 'image',
    key,
    file,
    alt,
    attributes: {
      credit: credit.author,
      ...(credit.authorUrl ? { creditUrl: credit.authorUrl } : {}),
      source: credit.source,
      sourceUrl: credit.url,
      license: credit.license,
      ...attributes,
    },
  }
}
// a file that isn't an image, like a PDF, under a name to link it by
export const asset = (key: string, file: string, name: string, attributes?: Attributes): Block => ({
  type: 'asset',
  key,
  file,
  name,
  attributes,
})
export const meta = (key: string, text: string, attributes?: Attributes): Block => ({
  type: 'meta',
  key,
  text,
  attributes,
})
export const group = (key: string, blocks: Block[], attributes?: Attributes): Block => ({
  type: 'group',
  key,
  blocks,
  attributes,
})

// Markdown for a list, and for numbered steps
export const list = (...items: string[]): string => items.map((item) => `- ${item}`).join('\n')
export const steps = (...items: string[]): string =>
  items.map((item, i) => `${i + 1}. ${item}`).join('\n')
