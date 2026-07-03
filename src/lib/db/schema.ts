import { sql } from 'drizzle-orm'
import {
  blob,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

export const category = sqliteTable(
  'category',
  {
    id: text('id').primaryKey().notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    shortid: text('shortid').notNull().default(''),
  },
  (t) => ({
    shortidIdx: uniqueIndex('category_ix_shortid').on(t.shortid),
    slugIdx: index('category_ix_slug').on(t.slug),
  }),
)

export const post = sqliteTable(
  'post',
  {
    id: text('id').primaryKey().notNull(),
    shortid: text('shortid').notNull().default(''),
    name: text('name').notNull(),
    slug: text('slug').notNull().default(''),
    createdAt: text('createdAt')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updatedAt')
      .notNull()
      .default(sql`(datetime('now'))`),
    status: text('status', { enum: ['published', 'draft'] })
      .notNull()
      .default('draft'),
  },
  (t) => ({
    shortidIdx: uniqueIndex('post_ix_shortid').on(t.shortid),
    slugIdx: index('post_ix_slug').on(t.slug),
  }),
)

export const block = sqliteTable('block', {
  id: text('id').primaryKey().notNull(),
  content: text('content').notNull(),
})

export const page = sqliteTable('page', {
  id: text('id').primaryKey().notNull(),
  key: text('key').notNull().unique(),
})

export const tag = sqliteTable(
  'tag',
  {
    id: text('id').primaryKey().notNull(),
    shortid: text('shortid').notNull().default(''),
    name: text('name').notNull(),
    slug: text('slug').notNull().default(''),
    createdAt: text('createdAt')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updatedAt')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    shortidIdx: uniqueIndex('tag_ix_shortid').on(t.shortid),
    slugIdx: index('tag_ix_slug').on(t.slug),
  }),
)

export const attribute = sqliteTable('attribute', {
  id: text('id').primaryKey().notNull(),
  key: text('key').notNull(),
  translatable: integer('translatable').notNull().default(0),
  text: text('text').notNull().default(''),
})

export const asset = sqliteTable('asset', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  mime: text('mime').notNull(),
  data: blob('data', { mode: 'buffer' }).notNull().$type<Buffer>(),
  createdAt: integer('createdAt')
    .notNull()
    .default(sql`(unixepoch())`),
  content: text('content'),
})

export const localizations = sqliteTable(
  'localizations',
  {
    id: text('id').primaryKey().notNull(),
    key: text('key').notNull(),
    locale: text('locale').notNull(),
    text: text('text').notNull(),
  },
  (t) => ({
    keyLocaleIdx: uniqueIndex('localizations_ix_key_locale').on(t.key, t.locale),
    keyIdx: index('localizations_ix_key').on(t.key),
  }),
)

export const user = sqliteTable('user', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull().unique(),
  password_hash: text('password_hash').notNull(),
})

export const parentBlock = sqliteTable(
  'parent_block',
  {
    blockId: text('blockId')
      .primaryKey()
      .notNull()
      .references(() => block.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    parentId: text('parentId').notNull(),
    parentTable: text('parentTable').notNull(),
    position: integer('position').notNull().default(0),
  },
  (t) => ({
    parentIdx: index('parent_block_ix_parent').on(t.parentTable, t.parentId),
    parentPositionIdx: index('parent_block_ix_parent_position').on(
      t.parentTable,
      t.parentId,
      t.position,
    ),
  }),
)

export const parentPost = sqliteTable(
  'parent_post',
  {
    postId: text('postId')
      .primaryKey()
      .notNull()
      .references(() => post.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    parentId: text('parentId').notNull(),
    parentTable: text('parentTable').notNull(),
    position: real('position').notNull().default(0),
  },
  (t) => ({
    parentIdx: index('parent_post_ix_parent').on(t.parentTable, t.parentId),
    parentPositionIdx: index('parent_post_ix_parent_position').on(
      t.parentTable,
      t.parentId,
      t.position,
    ),
  }),
)

export const parentAsset = sqliteTable(
  'parent_asset',
  {
    assetId: text('assetId')
      .notNull()
      .references(() => asset.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    parentId: text('parentId').notNull(),
    parentTable: text('parentTable').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.assetId, t.parentId, t.parentTable] }),
    parentIdx: index('parent_asset_ix_parent').on(t.parentTable, t.parentId),
  }),
)

export const parentTag = sqliteTable(
  'parent_tag',
  {
    tagId: text('tagId')
      .notNull()
      .references(() => tag.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    parentId: text('parentId').notNull(),
    parentTable: text('parentTable').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tagId, t.parentId, t.parentTable] }),
    parentIdx: index('parent_tag_ix_parent').on(t.parentTable, t.parentId),
  }),
)

export const parentAttribute = sqliteTable(
  'parent_attribute',
  {
    attributeId: text('attributeId')
      .primaryKey()
      .notNull()
      .references(() => attribute.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    parentId: text('parentId').notNull(),
    parentTable: text('parentTable').notNull(),
  },
  (t) => ({
    parentIdx: index('parent_attribute_ix_parent').on(t.parentTable, t.parentId),
  }),
)

export const schema = {
  category,
  post,
  block,
  page,
  tag,
  attribute,
  asset,
  localizations,
  user,
  parentBlock,
  parentPost,
  parentAsset,
  parentTag,
  parentAttribute,
}

export type Schema = typeof schema
