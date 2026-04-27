import { and, eq, inArray } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import { attribute, parentAttribute } from '@cms/lib/db/schema'
import { AttributeQuery } from './AttributeQuery'

export type AttributeData = {
  id: string
  key: string
  translatable: boolean
  text: string
}

export class AttributeStore {
  constructor(private db: Db) {}

  query(): AttributeQuery {
    return AttributeQuery.for(this.db)
  }

  /** Convenience used by BlockQuery during row hydration. */
  async getByParent(parentTable: string, parentId: string): Promise<AttributeData[]> {
    const rows = await this.db
      .select({
        id: attribute.id,
        key: attribute.key,
        translatable: attribute.translatable,
        text: attribute.text,
      })
      .from(attribute)
      .innerJoin(parentAttribute, eq(parentAttribute.attributeId, attribute.id))
      .where(and(eq(parentAttribute.parentTable, parentTable), eq(parentAttribute.parentId, parentId)))
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      translatable: r.translatable === 1,
      text: r.text,
    }))
  }

  async saveByParent(
    parentTable: string,
    parentId: string,
    attrs: AttributeData[],
  ): Promise<void> {
    validateAttributes(attrs)
    const orphans = (
      await this.db
        .select({ id: parentAttribute.attributeId })
        .from(parentAttribute)
        .where(
          and(eq(parentAttribute.parentTable, parentTable), eq(parentAttribute.parentId, parentId)),
        )
    ).map((r) => r.id)
    if (orphans.length > 0) {
      await this.db.delete(attribute).where(inArray(attribute.id, orphans))
    }
    for (const attr of attrs) {
      await this.db.insert(attribute).values({
        id: attr.id,
        key: attr.key,
        translatable: attr.translatable ? 1 : 0,
        text: attr.text,
      })
      await this.db
        .insert(parentAttribute)
        .values({ attributeId: attr.id, parentId, parentTable })
    }
  }
}

const validateAttributes = (attrs: AttributeData[]): void => {
  const seen = new Set<string>()
  for (const attr of attrs) {
    if (!attr.key) throw new Error('Attribute key is required')
    if (seen.has(attr.key)) throw new Error('Duplicate attribute key: ' + attr.key)
    seen.add(attr.key)
  }
}
