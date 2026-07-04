import { and, gte, lt, sql } from 'drizzle-orm'
import { v7 } from 'uuid'
import { type Db } from '@cms/lib/db/client'
import { localizations } from '@cms/lib/db/schema'

export type Translations = Record<string, Record<string, string>>

type LocalizationRow = {
  id: string
  key: string
  locale: string
  text: string
}

export class LocalizationStore {
  constructor(private db: Db) {}

  async getByKeyPrefix(prefix: string): Promise<Translations> {
    const rows = await this.db
      .select({
        id: localizations.id,
        key: localizations.key,
        locale: localizations.locale,
        text: localizations.text,
      })
      .from(localizations)
      .where(keyPrefixPredicate(prefix))
    return rowsToTranslations(rows)
  }

  async getByBlockParentIds(parentTable: string, ids: string[]): Promise<Translations> {
    if (ids.length === 0) return {}
    const idList = sql.join(
      ids.map((id) => sql`${id}`),
      sql.raw(', '),
    )
    const result = await this.db.all<LocalizationRow>(sql`
      WITH RECURSIVE block_tree(id) AS (
        SELECT blockId FROM parent_block
         WHERE parentTable = ${parentTable} AND parentId IN (${idList})
        UNION ALL
        SELECT pb.blockId FROM parent_block pb
          INNER JOIN block_tree bt ON pb.parentTable = 'block' AND pb.parentId = bt.id
      )
      SELECT l.id, l.key, l.locale, l.text FROM localizations l
      WHERE l.key IN (
        SELECT 'block:' || id || ':text' FROM block_tree
        UNION ALL
        SELECT 'block:' || id || ':alt' FROM block_tree
      )
    `)
    return rowsToTranslations(result)
  }

  async getByParentId(parentTable: string, parentId: string): Promise<Translations> {
    const { lower, upper } = keyPrefixRange(`${parentTable}:${parentId}:`)
    const result = await this.db.all<LocalizationRow>(sql`
      WITH RECURSIVE block_tree(id) AS (
        SELECT blockId FROM parent_block
         WHERE parentTable = ${parentTable} AND parentId = ${parentId}
        UNION ALL
        SELECT pb.blockId FROM parent_block pb
          INNER JOIN block_tree bt ON pb.parentTable = 'block' AND pb.parentId = bt.id
      ),
      attribute_ids(id) AS (
        SELECT attributeId FROM parent_attribute
         WHERE parentTable = ${parentTable} AND parentId = ${parentId}
        UNION ALL
        SELECT pa.attributeId FROM parent_attribute pa
          JOIN block_tree bt ON pa.parentTable = 'block' AND pa.parentId = bt.id
      )
      SELECT l.id, l.key, l.locale, l.text FROM localizations l
      WHERE (l.key >= ${lower} AND l.key < ${upper})
        OR l.key IN (
          SELECT 'block:' || id || ':text' FROM block_tree
          UNION ALL
          SELECT 'block:' || id || ':alt' FROM block_tree
          UNION ALL
          SELECT 'attribute:' || id || ':text' FROM attribute_ids
        )
    `)
    return rowsToTranslations(result)
  }

  async deleteBlockTranslationsByParentId(parentTable: string, parentId: string): Promise<void> {
    await this.db.run(sql`
      DELETE FROM localizations
      WHERE key IN (
        WITH RECURSIVE block_tree(id) AS (
          SELECT blockId FROM parent_block
           WHERE parentTable = ${parentTable} AND parentId = ${parentId}
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
      )
    `)
  }

  async save(deleteKeyPrefix: string, translations: Translations): Promise<void> {
    await this.db.delete(localizations).where(keyPrefixPredicate(deleteKeyPrefix))
    for (const [locale, entries] of Object.entries(translations)) {
      for (const [key, text] of Object.entries(entries)) {
        if (!text) continue
        await this.db.insert(localizations).values({ id: v7(), key, locale, text })
      }
    }
  }
}

/**
 * Range equivalent of `key LIKE prefix || '%'` that can use the key index:
 * default LIKE is case-insensitive, which disqualifies the BINARY-collation
 * index and full-scans the table. The upper bound is the prefix with its
 * last character incremented — well-defined here because every key prefix
 * ends in an ASCII character.
 */
function keyPrefixRange(prefix: string): { lower: string; upper: string } {
  if (!prefix) throw new Error('key prefix must not be empty')
  const upper = prefix.slice(0, -1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1)
  return { lower: prefix, upper }
}

function keyPrefixPredicate(prefix: string) {
  const { lower, upper } = keyPrefixRange(prefix)
  return and(gte(localizations.key, lower), lt(localizations.key, upper))
}

function rowsToTranslations(rows: LocalizationRow[]): Translations {
  const result: Translations = {}
  for (const row of rows) {
    if (!result[row.locale]) result[row.locale] = {}
    result[row.locale][row.key] = row.text
  }
  return result
}
