import { Database } from 'sqlite'
import { type BlockType, type BlockData, blockParentSchema } from '@cms/lib/blocks/declarations'
import { LocalizationStore, Translations } from './LocalizationStore'
import { AttributeStore } from './AttributeStore'
import { intoResult } from '@cms/utils/result'
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

const blockChildColumnSchema = valita.literal('id')
const blockQuerySchema = valita.union(
  allQueryVariantSchema(),
  columnQueryVariantSchema(blockChildColumnSchema),
  parentQueryVariantSchema(
    valita.literal('post'),
    valita.union(valita.literal('id'), valita.literal('shortid'), valita.literal('slug')),
  ),
  parentQueryVariantSchema(
    valita.literal('page'),
    valita.union(valita.literal('id'), valita.literal('key')),
  ),
  parentQueryVariantSchema(
    valita.literal('category'),
    valita.union(valita.literal('id'), valita.literal('shortid'), valita.literal('slug')),
  ),
  parentQueryVariantSchema(valita.literal('block'), valita.literal('id')),
)
const blockOrderFieldSchema = valita.literal('id')

export type BlockQuery = valita.Infer<typeof blockQuerySchema>
export type BlockOrderField = valita.Infer<typeof blockOrderFieldSchema>
export type BlockGetOptions = GetByParentOptionsBase<BlockOrderField>

const BLOCK_CHILD_COLUMNS: Record<valita.Infer<typeof blockChildColumnSchema>, string> = {
  id: 'b.id',
}
const BLOCK_ORDER_FIELDS: Record<BlockOrderField, string> = {
  id: 'b.id',
}

const conditionToSql = (c: 'eq' | 'neq' | 'like'): string =>
  c === 'eq' ? '=' : c === 'neq' ? '!=' : 'LIKE'

export type RawBlockData = {
  id: string
  parentId: string | null
  parentTable: string | null
  type: string
  content: string
}

const SELECT_BLOCK_WITH_PARENT = `
  SELECT b.id, pb.parentId, pb.parentTable, b.type, b.content
    FROM block b
    LEFT JOIN parent_block pb ON pb.blockId = b.id
`

export class BlockStore {
  constructor(private db: Database) {}

  async get(query: BlockQuery, options: BlockGetOptions = {}): Promise<BlockData[]> {
    parseIdentifier(blockQuerySchema, query, 'query')
    if (options.order) parseIdentifier(blockOrderFieldSchema, options.order.field, 'order.field')
    if (query.type !== 'all' && !query.value) return []

    const orderBy = options.order
      ? `${BLOCK_ORDER_FIELDS[options.order.field]} ${sqlOrder(options.order.order)}`
      : `b.id ASC`
    const selectColumns = 'b.id, pb.parentId, pb.parentTable, b.type, b.content'

    let rows: RawBlockData[]
    if (query.type === 'parent') {
      const { sql, params } = buildGetByParentQuery({
        child: {
          childTable: 'block',
          childAlias: 'b',
          joinTable: 'parent_block',
          joinAlias: 'pb',
          joinChildKey: 'blockId',
        },
        selectColumns,
        parentTable: query.table,
        parentColumn: query.column,
        condition: query.condition ?? 'eq',
        parentId: query.value,
        orderBy,
        limit: options.limit,
        offset: options.offset,
      })
      rows = await this.db.all<RawBlockData[]>(sql, ...params)
    } else {
      const params: unknown[] = []
      const lines: string[] = [
        `SELECT ${selectColumns}`,
        `  FROM block b`,
        `  LEFT JOIN parent_block pb ON pb.blockId = b.id`,
      ]
      const whereClauses: string[] = []
      if (query.type === 'column') {
        whereClauses.push(
          `${BLOCK_CHILD_COLUMNS[query.column]} ${conditionToSql(query.condition ?? 'eq')} ?`,
        )
        params.push(query.value)
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
      rows = await this.db.all<RawBlockData[]>(lines.join('\n'), ...params)
    }

    const blocks = await Promise.all(rows.map((r) => this.toBlockData(r)))
    if (!options.locale) return blocks

    // Bucket by parentTable so getByBlockParentIds gets a coherent CTE input.
    const byTable = new Map<string, Set<string>>()
    for (const r of rows) {
      if (!r.parentTable || !r.parentId) continue
      let bucket = byTable.get(r.parentTable)
      if (!bucket) {
        bucket = new Set<string>()
        byTable.set(r.parentTable, bucket)
      }
      bucket.add(r.parentId)
    }
    const allTranslations: Translations = {}
    const localizationStore = new LocalizationStore(this.db)
    for (const [table, ids] of byTable) {
      const t = await localizationStore.getByBlockParentIds(table, Array.from(ids))
      for (const [locale, entries] of Object.entries(t)) {
        if (!allTranslations[locale]) allTranslations[locale] = {}
        Object.assign(allTranslations[locale], entries)
      }
    }
    const locale = options.locale
    return blocks.map((b) => applyTranslations(b, allTranslations, locale))
  }

  async getPublicByParentIds(
    locale: string,
    parentTable: string,
    ids: string[],
  ): Promise<Record<string, BlockData[]>> {
    if (ids.length === 0) return {}
    const placeholders = ids.map(() => '?').join(', ')
    const rows = await this.db.all<RawBlockData[]>(
      `${SELECT_BLOCK_WITH_PARENT} WHERE pb.parentTable = ? AND pb.parentId IN (${placeholders})`,
      parentTable,
      ...ids,
    )
    const blocks = await Promise.all(rows.map((r) => this.toBlockData(r)))
    const translations = await new LocalizationStore(this.db).getByBlockParentIds(parentTable, ids)

    const result: Record<string, BlockData[]> = {}
    for (const block of blocks) {
      if (block.parent.type !== parentTable) continue
      const parentId = block.parent.id
      if (!result[parentId]) result[parentId] = []
      result[parentId].push(applyTranslations(block, translations, locale))
    }
    return result
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM block WHERE id = ?', id)
    return (result.changes ?? 0) > 0
  }

  async deleteByParent(parentTable: string, parentId: string): Promise<void> {
    await this.db.run(
      `DELETE FROM block WHERE id IN (
         SELECT blockId FROM parent_block
          WHERE parentTable = ? AND parentId = ?
       )`,
      parentTable,
      parentId,
    )
  }

  async saveByParent(parentTable: string, parentId: string, blocks: BlockData[]): Promise<void> {
    await this.deleteByParent(parentTable, parentId)
    await this.insertBlocks(blocks, { parentTable, parentId })
    await this.db.run('DELETE FROM asset WHERE id NOT IN (SELECT assetId FROM parent_asset)')
  }

  private async insertBlocks(
    blocks: BlockData[],
    parent: { parentTable: string; parentId: string },
  ): Promise<void> {
    for (const block of blocks) {
      const isGroup = block.content.type === 'group'
      const content = isGroup
        ? JSON.stringify({ type: block.content.type, key: block.content.key })
        : JSON.stringify(block.content)
      await this.db.run(
        'INSERT INTO block (id, type, content) VALUES (?, ?, ?)',
        block.id,
        block.type,
        content,
      )
      await this.db.run(
        'INSERT INTO parent_block (blockId, parentId, parentTable) VALUES (?, ?, ?)',
        block.id,
        parent.parentId,
        parent.parentTable,
      )
      await new AttributeStore(this.db).saveByParent('block', block.id, block.attributes)
      if (
        (block.content.type === 'image' || block.content.type === 'asset') &&
        block.content.assetId
      ) {
        await this.db.run(
          'INSERT OR IGNORE INTO parent_asset (assetId, parentId, parentTable) VALUES (?, ?, ?)',
          block.content.assetId,
          block.id,
          'block',
        )
      }
      if (block.content.type === 'group') {
        await this.insertBlocks(block.content.blocks, { parentTable: 'block', parentId: block.id })
      }
    }
  }

  private async toBlockData(raw: RawBlockData): Promise<BlockData> {
    if (raw.parentId == null || raw.parentTable == null)
      throw new InvalidBlockContentError('Block has no parent')
    const parentResult = intoResult(() =>
      blockParentSchema.parse({ type: raw.parentTable, id: raw.parentId }),
    )
    if (parentResult.error) throw new InvalidBlockContentError('Invalid parent table')
    const parent = parentResult.value

    const parsed = JSON.parse(raw.content) as unknown
    if (parsed == null || typeof parsed !== 'object')
      throw new InvalidBlockContentError('Invalid block content')
    if (!('type' in parsed) || typeof parsed.type !== 'string')
      throw new InvalidBlockContentError('Invalid block content: missing type')
    if (!('key' in parsed) || typeof parsed.key !== 'string')
      throw new InvalidBlockContentError('Invalid block content: missing key')

    const type = parsed.type
    const key = parsed.key

    const content = await (async () => {
      if (type === 'group') {
        const childRows = await this.db.all<RawBlockData[]>(
          `${SELECT_BLOCK_WITH_PARENT} WHERE pb.parentTable = 'block' AND pb.parentId = ?`,
          raw.id,
        )
        const blocks = await Promise.all(childRows.map((r) => this.toBlockData(r)))
        return { type: 'group', key, blocks } satisfies BlockType
      }
      return parsed as BlockType
    })()

    const attributes = await new AttributeStore(this.db).get({
      type: 'parent',
      table: 'block',
      column: 'id',
      value: raw.id,
    })

    return { id: raw.id, parent, type: raw.type, content, attributes }
  }
}

const applyTranslations = (
  block: BlockData,
  translations: Translations,
  locale: string,
): BlockData => {
  const localeMap = translations[locale]
  if (!localeMap) return block

  if (block.content.type === 'text') {
    const text = localeMap['block:' + block.id + ':text']
    if (!text) return block
    return { ...block, content: { ...block.content, text } }
  }

  if (block.content.type === 'image') {
    const alt = localeMap['block:' + block.id + ':alt']
    if (!alt) return block
    return { ...block, content: { ...block.content, alt } }
  }

  if (block.content.type === 'group') {
    return {
      ...block,
      content: {
        ...block.content,
        blocks: block.content.blocks.map((b) => applyTranslations(b, translations, locale)),
      },
    }
  }

  return block
}

export class InvalidBlockContentError extends Error {}
export class PostNotFoundError extends Error {}
