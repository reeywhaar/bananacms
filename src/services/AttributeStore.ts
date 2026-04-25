import { Database } from 'sqlite'

export type AttributeData = {
  id: string
  key: string
  translatable: boolean
  text: string
}

type RawAttributeRow = {
  id: string
  key: string
  translatable: number
  text: string
  parentId?: string
}

export class AttributeStore {
  constructor(private db: Database) {}

  async getByParent(parentTable: string, parentId: string): Promise<AttributeData[]> {
    const rows = await this.db.all<RawAttributeRow[]>(
      `SELECT a.id, a.key, a.translatable, a.text
         FROM attribute a
         JOIN parent_attribute pa ON pa.attributeId = a.id
        WHERE pa.parentTable = ? AND pa.parentId = ?
        ORDER BY a.id ASC`,
      parentTable,
      parentId,
    )
    return rows.map(toAttributeData)
  }

  async getByParentIds(
    parentTable: string,
    parentIds: string[],
  ): Promise<Record<string, AttributeData[]>> {
    if (parentIds.length === 0) return {}
    const placeholders = parentIds.map(() => '?').join(', ')
    const rows = await this.db.all<RawAttributeRow[]>(
      `SELECT a.id, a.key, a.translatable, a.text, pa.parentId AS parentId
         FROM attribute a
         JOIN parent_attribute pa ON pa.attributeId = a.id
        WHERE pa.parentTable = ? AND pa.parentId IN (${placeholders})
        ORDER BY a.id ASC`,
      parentTable,
      ...parentIds,
    )
    const result: Record<string, AttributeData[]> = {}
    for (const row of rows) {
      const parentId = row.parentId!
      if (!result[parentId]) result[parentId] = []
      result[parentId].push(toAttributeData(row))
    }
    return result
  }

  async saveByParent(
    parentTable: string,
    parentId: string,
    attrs: AttributeData[],
  ): Promise<void> {
    validateAttributes(attrs)
    await this.db.run(
      `DELETE FROM attribute WHERE id IN (
         SELECT attributeId FROM parent_attribute
          WHERE parentTable = ? AND parentId = ?
       )`,
      parentTable,
      parentId,
    )
    for (const attr of attrs) {
      await this.db.run(
        'INSERT INTO attribute (id, key, translatable, text) VALUES (?, ?, ?, ?)',
        attr.id,
        attr.key,
        attr.translatable ? 1 : 0,
        attr.text,
      )
      await this.db.run(
        'INSERT INTO parent_attribute (attributeId, parentId, parentTable) VALUES (?, ?, ?)',
        attr.id,
        parentId,
        parentTable,
      )
    }
  }
}

const toAttributeData = (row: RawAttributeRow): AttributeData => ({
  id: row.id,
  key: row.key,
  translatable: row.translatable === 1,
  text: row.text,
})

const validateAttributes = (attrs: AttributeData[]): void => {
  const seen = new Set<string>()
  for (const attr of attrs) {
    if (!attr.key) throw new Error('Attribute key is required')
    if (seen.has(attr.key)) throw new Error('Duplicate attribute key: ' + attr.key)
    seen.add(attr.key)
  }
}
