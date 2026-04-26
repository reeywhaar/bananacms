import { Database } from 'sqlite'
import { BlockStore } from './BlockStore'
import { LocalizationStore, Translations } from './LocalizationStore'
import { TagStore } from './TagStore'
import { AttributeStore, AttributeData } from './AttributeStore'
import { getShortId } from '@cms/utils/getshortid'
import { BlockData } from '@cms/lib/blocks/declarations'
import { valita } from '@cms/utils/valita'
import {
  GetByParentOptionsBase,
  allQueryVariantSchema,
  buildGetByParentQuery,
  columnQueryVariantSchema,
  parentQueryVariantSchema,
  parseIdentifier,
  sqlOrder,
} from './getByParentQuery'

const postChildColumnSchema = valita.union(
  valita.literal('id'),
  valita.literal('shortid'),
  valita.literal('slug'),
)
const postQuerySchema = valita.union(
  allQueryVariantSchema(),
  columnQueryVariantSchema(postChildColumnSchema),
  parentQueryVariantSchema(
    valita.union(valita.literal('category'), valita.literal('tag')),
    valita.union(valita.literal('id'), valita.literal('shortid'), valita.literal('slug')),
  ),
)
const postOrderFieldSchema = valita.union(
  valita.literal('position'),
  valita.literal('name'),
  valita.literal('createdAt'),
  valita.literal('updatedAt'),
  valita.literal('id'),
)

export type PostQuery = valita.Infer<typeof postQuerySchema>
export type PostOrderField = valita.Infer<typeof postOrderFieldSchema>
export type PostGetOptions = GetByParentOptionsBase<PostOrderField> & {
  status?: 'published' | 'draft'
}

const POST_CHILD_COLUMNS: Record<valita.Infer<typeof postChildColumnSchema>, string> = {
  id: 'p.id',
  shortid: 'p.shortid',
  slug: 'p.slug',
}
const POST_ORDER_FIELDS: Record<PostOrderField, string> = {
  position: 'pp.position',
  name: 'p.name',
  createdAt: 'p.createdAt',
  updatedAt: 'p.updatedAt',
  id: 'p.id',
}

const conditionToSql = (c: 'eq' | 'neq' | 'like'): string =>
  c === 'eq' ? '=' : c === 'neq' ? '!=' : 'LIKE'

export type PostData = {
  id: string
  shortid: string
  categoryId: string
  name: string
  slug: string
  createdAt: string
  updatedAt: string
  status: 'published' | 'draft'
}

export type PostPayload = {
  name: string
  slug: string
  categoryId: string
  status: 'published' | 'draft'
  blocks: BlockData[]
  translations: Translations
  tagIds: string[]
  attributes: AttributeData[]
}

export class PostStore {
  constructor(private db: Database) {}

  async get(query: PostQuery, options: PostGetOptions = {}): Promise<PostData[]> {
    parseIdentifier(postQuerySchema, query, 'query')
    if (options.order) parseIdentifier(postOrderFieldSchema, options.order.field, 'order.field')
    if (query.type !== 'all' && !query.value) return []

    const selectColumns = options.locale
      ? `p.id, p.shortid, pp.parentId AS categoryId, p.slug,
         COALESCE(l.text, p.name) AS name,
         p.createdAt, p.updatedAt, p.status`
      : `p.id, p.shortid, pp.parentId AS categoryId, p.slug, p.name,
         p.createdAt, p.updatedAt, p.status`

    const orderBy = options.order
      ? `${POST_ORDER_FIELDS[options.order.field]} ${sqlOrder(options.order.order)}, p.id ASC`
      : `pp.position ASC, p.id ASC`

    const localeJoins = options.locale
      ? {
          sql: `  LEFT JOIN localizations l ON l.key = 'post:' || p.id || ':name' AND l.locale = ?`,
          params: [options.locale] as unknown[],
        }
      : undefined

    if (query.type === 'parent') {
      if (query.table === 'tag') {
        return this.getByTag(query, options, selectColumns, orderBy, localeJoins)
      }
      const { sql, params } = buildGetByParentQuery({
        child: {
          childTable: 'post',
          childAlias: 'p',
          joinTable: 'parent_post',
          joinAlias: 'pp',
          joinChildKey: 'postId',
        },
        selectColumns,
        parentTable: query.table,
        parentColumn: query.column,
        condition: query.condition ?? 'eq',
        parentId: query.value,
        extraWhere: options.status ? { sql: 'p.status = ?', params: [options.status] } : undefined,
        orderBy,
        limit: options.limit,
        offset: options.offset,
        localeJoins,
      })
      return this.db.all<PostData[]>(sql, ...params)
    }

    const params: unknown[] = []
    const lines: string[] = [
      `SELECT ${selectColumns}`,
      `  FROM post p`,
      `  LEFT JOIN parent_post pp ON pp.postId = p.id AND pp.parentTable = 'category'`,
    ]
    if (localeJoins) {
      lines.push(localeJoins.sql)
      params.push(...localeJoins.params)
    }
    const whereClauses: string[] = []
    if (query.type === 'column') {
      whereClauses.push(
        `${POST_CHILD_COLUMNS[query.column]} ${conditionToSql(query.condition ?? 'eq')} ?`,
      )
      params.push(query.value)
    }
    if (options.status) {
      whereClauses.push('p.status = ?')
      params.push(options.status)
    }
    if (whereClauses.length) lines.push(` WHERE ${whereClauses.join(' AND ')}`)
    lines.push(` ORDER BY ${orderBy}`)
    if (options.limit !== undefined) {
      lines.push(' LIMIT ?')
      params.push(options.limit)
      if (options.offset !== undefined) {
        lines.push(' OFFSET ?')
        params.push(options.offset)
      }
    }
    return this.db.all<PostData[]>(lines.join('\n'), ...params)
  }

  async add(id: string, payload: PostPayload): Promise<void> {
    validatePostPayload(payload)
    if (!payload.categoryId) throw new Error('Category is required')
    await this.db.run('BEGIN TRANSACTION')
    try {
      await this.db.run(
        'INSERT INTO post (id, shortid, name, slug, status) VALUES (?, ?, ?, ?, ?)',
        id,
        getShortId(id),
        payload.name,
        payload.slug,
        payload.status,
      )
      const topPosition = await this.topPositionFor('category', payload.categoryId)
      await this.db.run(
        'INSERT INTO parent_post (postId, parentId, parentTable, position) VALUES (?, ?, ?, ?)',
        id,
        payload.categoryId,
        'category',
        topPosition,
      )
      await new AttributeStore(this.db).saveByParent('post', id, payload.attributes)
      await new BlockStore(this.db).saveByParent('post', id, payload.blocks)
      await new LocalizationStore(this.db).save('post:' + id + ':', payload.translations)
      await new TagStore(this.db).setParent('post', id, payload.tagIds)
      await this.db.run('COMMIT')
    } catch (e) {
      await this.db.run('ROLLBACK')
      throw e
    }
  }

  async update(id: string, payload: PostPayload): Promise<void> {
    validatePostPayload(payload)
    await this.db.run('BEGIN TRANSACTION')
    try {
      await this.db.run(
        "UPDATE post SET name = ?, slug = ?, status = ?, updatedAt = datetime('now') WHERE id = ?",
        payload.name,
        payload.slug,
        payload.status,
        id,
      )
      const existingParent = await this.db.get<{ parentId: string; parentTable: string }>(
        `SELECT parentId, parentTable FROM parent_post WHERE postId = ?`,
        id,
      )
      const categoryChanged =
        !existingParent ||
        existingParent.parentTable !== 'category' ||
        existingParent.parentId !== payload.categoryId
      if (categoryChanged) {
        const topPosition = await this.topPositionFor('category', payload.categoryId)
        await this.db.run(
          `UPDATE parent_post SET parentId = ?, parentTable = 'category', position = ? WHERE postId = ?`,
          payload.categoryId,
          topPosition,
          id,
        )
      }
      await new LocalizationStore(this.db).deleteBlockTranslationsByParentId('post', id)
      await new AttributeStore(this.db).saveByParent('post', id, payload.attributes)
      await new BlockStore(this.db).saveByParent('post', id, payload.blocks)
      await new LocalizationStore(this.db).save('post:' + id + ':', payload.translations)
      await new TagStore(this.db).setParent('post', id, payload.tagIds)
      await this.db.run('COMMIT')
    } catch (e) {
      await this.db.run('ROLLBACK')
      throw e
    }
  }

  async move(postId: string, afterId: string | null): Promise<void> {
    await this.db.run('BEGIN TRANSACTION')
    try {
      const current = await this.db.get<{ parentTable: string; parentId: string }>(
        `SELECT parentTable, parentId FROM parent_post WHERE postId = ?`,
        postId,
      )
      if (!current) throw new Error('Post has no parent')

      const siblings = await this.db.all<{ postId: string; position: number }[]>(
        `SELECT postId, position FROM parent_post
         WHERE parentTable = ? AND parentId = ? AND postId != ?
         ORDER BY position ASC, postId ASC`,
        current.parentTable,
        current.parentId,
        postId,
      )

      let newPosition: number
      if (afterId === null) {
        newPosition = siblings.length ? siblings[0].position - 1 : 1
      } else {
        const anchorIndex = siblings.findIndex((s) => s.postId === afterId)
        if (anchorIndex === -1) throw new Error('afterId not found in the same parent')
        const anchor = siblings[anchorIndex]
        const next = siblings[anchorIndex + 1]
        if (!next) {
          newPosition = anchor.position + 1
        } else if (next.position - anchor.position < POSITION_EPSILON) {
          await this.rebalance(current.parentTable, current.parentId)
          const rebalanced = await this.db.all<{ postId: string; position: number }[]>(
            `SELECT postId, position FROM parent_post
             WHERE parentTable = ? AND parentId = ? AND postId != ?
             ORDER BY position ASC, postId ASC`,
            current.parentTable,
            current.parentId,
            postId,
          )
          const idx = rebalanced.findIndex((s) => s.postId === afterId)
          const a = rebalanced[idx]
          const n = rebalanced[idx + 1]
          newPosition = n ? (a.position + n.position) / 2 : a.position + 1
        } else {
          newPosition = (anchor.position + next.position) / 2
        }
      }

      await this.db.run(`UPDATE parent_post SET position = ? WHERE postId = ?`, newPosition, postId)
      await this.db.run('COMMIT')
    } catch (e) {
      await this.db.run('ROLLBACK')
      throw e
    }
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM post WHERE id = ?', id)
  }

  private async getByTag(
    query: { column: 'id' | 'shortid' | 'slug'; value: string; condition?: 'eq' | 'neq' | 'like' },
    options: PostGetOptions,
    selectColumns: string,
    orderBy: string,
    localeJoins?: { sql: string; params: unknown[] },
  ): Promise<PostData[]> {
    const params: unknown[] = []
    const lines: string[] = [
      `SELECT ${selectColumns}`,
      `  FROM post p`,
      `  LEFT JOIN parent_post pp ON pp.postId = p.id AND pp.parentTable = 'category'`,
      `  JOIN parent_tag pt ON pt.parentId = p.id AND pt.parentTable = 'post'`,
    ]
    if (query.column !== 'id') {
      lines.push(`  JOIN tag t ON t.id = pt.tagId`)
    }
    if (localeJoins) {
      lines.push(localeJoins.sql)
      params.push(...localeJoins.params)
    }
    const op = conditionToSql(query.condition ?? 'eq')
    const tagColumn = query.column === 'id' ? 'pt.tagId' : `t.${query.column}`
    const whereClauses: string[] = [`${tagColumn} ${op} ?`]
    params.push(query.value)
    if (options.status) {
      whereClauses.push('p.status = ?')
      params.push(options.status)
    }
    lines.push(` WHERE ${whereClauses.join(' AND ')}`)
    lines.push(` ORDER BY ${orderBy}`)
    if (options.limit !== undefined) {
      lines.push(' LIMIT ?')
      params.push(options.limit)
      if (options.offset !== undefined) {
        lines.push(' OFFSET ?')
        params.push(options.offset)
      }
    }
    return this.db.all<PostData[]>(lines.join('\n'), ...params)
  }

  private async topPositionFor(parentTable: string, parentId: string): Promise<number> {
    const row = await this.db.get<{ min: number | null }>(
      `SELECT MIN(position) AS min FROM parent_post WHERE parentTable = ? AND parentId = ?`,
      parentTable,
      parentId,
    )
    return row?.min == null ? 1 : row.min - 1
  }

  private async rebalance(parentTable: string, parentId: string): Promise<void> {
    const rows = await this.db.all<{ postId: string }[]>(
      `SELECT postId FROM parent_post
       WHERE parentTable = ? AND parentId = ?
       ORDER BY position ASC, postId ASC`,
      parentTable,
      parentId,
    )
    for (let i = 0; i < rows.length; i++) {
      await this.db.run(
        `UPDATE parent_post SET position = ? WHERE postId = ?`,
        i + 1,
        rows[i].postId,
      )
    }
  }
}

const POSITION_EPSILON = 1e-6

const validatePostPayload = (payload: PostPayload) => {
  if (!payload.name) throw new Error('Name is required')
  if (!payload.slug) throw new Error('Slug is required')
  if (!payload.categoryId) throw new Error('Category is required')
}
