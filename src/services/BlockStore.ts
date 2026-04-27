import { and, eq, inArray, notInArray } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import { block, parentBlock, asset, parentAsset } from '@cms/lib/db/schema'
import { type BlockData } from '@cms/lib/blocks/declarations'
import { AttributeStore } from './AttributeStore'
import { BlockQuery, type BlockParentTable } from './BlockQuery'

export { InvalidBlockContentError } from './BlockQuery'
export class PostNotFoundError extends Error {}

export class BlockStore {
  constructor(private db: Db) {}

  query(): BlockQuery {
    return BlockQuery.for(this.db)
  }

  async getPublicByParentIds(
    locale: string,
    parentTable: BlockParentTable,
    ids: string[],
  ): Promise<Record<string, BlockData[]>> {
    if (ids.length === 0) return {}

    // One batched query for top-level blocks across all parents; BlockQuery
    // handles group hydration and translations internally (the latter via a
    // single recursive-CTE call covering every parent id at once).
    const blocks = await BlockQuery.for(this.db)
      .locale(locale)
      .parentedBy({ table: parentTable, ids })
      .all()

    const result: Record<string, BlockData[]> = {}
    for (const id of ids) result[id] = []
    for (const b of blocks) {
      if (b.parent.type !== parentTable) continue
      const bucket = result[b.parent.id]
      if (bucket) bucket.push(b)
    }
    return result
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(block).where(eq(block.id, id))
    return (result.rowsAffected ?? 0) > 0
  }

  async deleteByParent(parentTable: string, parentId: string): Promise<void> {
    const orphanIds = (
      await this.db
        .select({ blockId: parentBlock.blockId })
        .from(parentBlock)
        .where(and(eq(parentBlock.parentTable, parentTable), eq(parentBlock.parentId, parentId)))
    ).map((r) => r.blockId)
    if (orphanIds.length === 0) return
    await this.db.delete(block).where(inArray(block.id, orphanIds))
  }

  async saveByParent(parentTable: string, parentId: string, blocks: BlockData[]): Promise<void> {
    await this.deleteByParent(parentTable, parentId)
    await this.insertBlocks(blocks, { parentTable, parentId })
    const referenced = (await this.db.select({ id: parentAsset.assetId }).from(parentAsset)).map(
      (r) => r.id,
    )
    if (referenced.length === 0) {
      await this.db.delete(asset)
    } else {
      await this.db.delete(asset).where(notInArray(asset.id, referenced))
    }
  }

  private async insertBlocks(
    blocks: BlockData[],
    parent: { parentTable: string; parentId: string },
  ): Promise<void> {
    for (const b of blocks) {
      const isGroup = b.content.type === 'group'
      const content = isGroup
        ? JSON.stringify({ type: b.content.type, key: b.content.key })
        : JSON.stringify(b.content)
      await this.db.insert(block).values({ id: b.id, type: b.type, content })
      await this.db
        .insert(parentBlock)
        .values({ blockId: b.id, parentId: parent.parentId, parentTable: parent.parentTable })
      await new AttributeStore(this.db).saveByParent('block', b.id, b.attributes)
      if (
        (b.content.type === 'image' || b.content.type === 'asset') &&
        b.content.assetId
      ) {
        await this.db
          .insert(parentAsset)
          .values({ assetId: b.content.assetId, parentId: b.id, parentTable: 'block' })
          .onConflictDoNothing()
      }
      if (b.content.type === 'group') {
        await this.insertBlocks(b.content.blocks, { parentTable: 'block', parentId: b.id })
      }
    }
  }
}
