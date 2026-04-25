import { Database } from 'sqlite'
import { v7 } from 'uuid'

export type Translations = Record<string, Record<string, string>>

type LocalizationRow = {
  id: string
  key: string
  locale: string
  text: string
}

export class LocalizationStore {
  constructor(private db: Database) {}

  async getByKeyPrefix(prefix: string): Promise<Translations> {
    const rows = await this.db.all<LocalizationRow[]>(
      'SELECT id, key, locale, text FROM localizations WHERE key LIKE ?',
      prefix + '%',
    )
    return rowsToTranslations(rows)
  }

  async getByBlockParentIds(parentTable: string, ids: string[]): Promise<Translations> {
    if (ids.length === 0) return {}
    const placeholders = ids.map(() => '?').join(', ')
    const rows = await this.db.all<LocalizationRow[]>(
      `WITH RECURSIVE block_tree(id) AS (
         SELECT blockId FROM parent_block
          WHERE parentTable = ? AND parentId IN (${placeholders})
         UNION ALL
         SELECT pb.blockId FROM parent_block pb
           INNER JOIN block_tree bt ON pb.parentTable = 'block' AND pb.parentId = bt.id
       )
       SELECT l.id, l.key, l.locale, l.text FROM localizations l
       WHERE l.key IN (
         SELECT 'block:' || id || ':text' FROM block_tree
         UNION ALL
         SELECT 'block:' || id || ':alt' FROM block_tree
       )`,
      parentTable,
      ...ids,
    )
    return rowsToTranslations(rows)
  }

  async getByParentId(parentTable: string, parentId: string): Promise<Translations> {
    const rows = await this.db.all<LocalizationRow[]>(
      `WITH RECURSIVE block_tree(id) AS (
         SELECT blockId FROM parent_block
          WHERE parentTable = ? AND parentId = ?
         UNION ALL
         SELECT pb.blockId FROM parent_block pb
           INNER JOIN block_tree bt ON pb.parentTable = 'block' AND pb.parentId = bt.id
       ),
       attribute_ids(id) AS (
         SELECT attributeId FROM parent_attribute
          WHERE parentTable = ? AND parentId = ?
         UNION ALL
         SELECT pa.attributeId FROM parent_attribute pa
           JOIN block_tree bt ON pa.parentTable = 'block' AND pa.parentId = bt.id
       )
       SELECT l.id, l.key, l.locale, l.text FROM localizations l
       WHERE l.key LIKE ? || ':' || ? || ':%'
         OR l.key IN (
           SELECT 'block:' || id || ':text' FROM block_tree
           UNION ALL
           SELECT 'block:' || id || ':alt' FROM block_tree
           UNION ALL
           SELECT 'attribute:' || id || ':text' FROM attribute_ids
         )`,
      parentTable,
      parentId,
      parentTable,
      parentId,
      parentTable,
      parentId,
    )
    return rowsToTranslations(rows)
  }

  async deleteBlockTranslationsByParentId(parentTable: string, parentId: string): Promise<void> {
    await this.db.run(
      `DELETE FROM localizations
       WHERE key IN (
         WITH RECURSIVE block_tree(id) AS (
           SELECT blockId FROM parent_block
            WHERE parentTable = ? AND parentId = ?
           UNION ALL
           SELECT pb.blockId FROM parent_block pb
             INNER JOIN block_tree bt ON pb.parentTable = 'block' AND pb.parentId = bt.id
         ),
         attribute_ids(id) AS (
           SELECT pa.attributeId FROM parent_attribute pa
             JOIN block_tree bt ON pa.parentTable = 'block' AND pa.parentId = bt.id
         )
         SELECT 'block:' || id || ':text' FROM block_tree
         UNION ALL
         SELECT 'block:' || id || ':alt' FROM block_tree
         UNION ALL
         SELECT 'attribute:' || id || ':text' FROM attribute_ids
       )`,
      parentTable,
      parentId,
    )
  }

  async save(deleteKeyPrefix: string, translations: Translations): Promise<void> {
    await this.db.run(
      'DELETE FROM localizations WHERE key LIKE ?',
      deleteKeyPrefix + '%',
    )
    for (const [locale, entries] of Object.entries(translations)) {
      for (const [key, text] of Object.entries(entries)) {
        if (!text) continue
        await this.db.run(
          'INSERT INTO localizations (id, key, locale, text) VALUES (?, ?, ?, ?)',
          v7(),
          key,
          locale,
          text,
        )
      }
    }
  }
}

function rowsToTranslations(rows: LocalizationRow[]): Translations {
  const result: Translations = {}
  for (const row of rows) {
    if (!result[row.locale]) result[row.locale] = {}
    result[row.locale][row.key] = row.text
  }
  return result
}
