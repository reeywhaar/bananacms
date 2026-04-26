import { Database } from 'sqlite'
import { type BlockType, type BlockData, blockParentSchema } from '@cms/lib/blocks/declarations'
import { LocalizationStore, Translations } from './LocalizationStore'
import { AttributeStore } from './AttributeStore'
import { intoResult } from '@cms/utils/result'
import { valita } from '@cms/utils/valita'
import {
  GetByParentOptionsBase,
  buildGetByParentQuery,
  parentDescriptorSchema,
  parseIdentifier,
  sqlOrder,
} from './getByParentQuery'

const blockParentInputSchema = valita.union(
  parentDescriptorSchema(
    valita.literal('post'),
    valita.union(valita.literal('id'), valita.literal('shortid')),
  ),
  parentDescriptorSchema(
    valita.literal('page'),
    valita.union(valita.literal('id'), valita.literal('key')),
  ),
  parentDescriptorSchema(
    valita.literal('category'),
    valita.union(valita.literal('id'), valita.literal('shortid'), valita.literal('slug')),
  ),
  parentDescriptorSchema(valita.literal('block'), valita.literal('id')),
)
const blockOrderFieldSchema = valita.literal('id')

export type BlockParent = valita.Infer<typeof blockParentInputSchema>
export type BlockParentTable = BlockParent['table']
export type BlockOrderField = valita.Infer<typeof blockOrderFieldSchema>
export type BlockGetByParentOptions = GetByParentOptionsBase<BlockOrderField>

const BLOCK_ORDER_FIELDS: Record<BlockOrderField, string> = {
  id: 'b.id',
}

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

  async get(id: string): Promise<BlockData | null> {
    const row = await this.db.get<RawBlockData>(`${SELECT_BLOCK_WITH_PARENT} WHERE b.id = ?`, id)
    return row ? this.toBlockData(row) : null
  }

  async getByParent(
    parent: BlockParent,
    options: BlockGetByParentOptions = {},
  ): Promise<BlockData[]> {
    parseIdentifier(blockParentInputSchema, parent, 'parent')
    if (options.order) parseIdentifier(blockOrderFieldSchema, options.order.field, 'order.field')
    if (!parent.value) return []

    const orderBy = options.order
      ? `${BLOCK_ORDER_FIELDS[options.order.field]} ${sqlOrder(options.order.order)}`
      : `b.id ASC`

    const { sql, params } = buildGetByParentQuery({
      child: {
        childTable: 'block',
        childAlias: 'b',
        joinTable: 'parent_block',
        joinAlias: 'pb',
        joinChildKey: 'blockId',
      },
      selectColumns: 'b.id, pb.parentId, pb.parentTable, b.type, b.content',
      parentTable: parent.table,
      parentColumn: parent.column,
      condition: parent.condition ?? 'eq',
      parentId: parent.value,
      orderBy,
      limit: options.limit,
      offset: options.offset,
    })
    const rows = await this.db.all<RawBlockData[]>(sql, ...params)
    const blocks = await Promise.all(rows.map((r) => this.toBlockData(r)))
    if (!options.locale) return blocks

    const parentIds = Array.from(new Set(rows.map((r) => r.parentId).filter((p): p is string => !!p)))
    if (parentIds.length === 0) return blocks
    const translations = await new LocalizationStore(this.db).getByBlockParentIds(
      parent.table,
      parentIds,
    )
    const locale = options.locale
    return blocks.map((b) => applyTranslations(b, translations, locale))
  }

  async getAll(): Promise<BlockData[]> {
    const rows = await this.db.all<RawBlockData[]>(`${SELECT_BLOCK_WITH_PARENT} ORDER BY b.id`)
    return Promise.all(rows.map((r) => this.toBlockData(r)))
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

    const attributes = await new AttributeStore(this.db).getByParent({
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
