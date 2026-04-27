import { eq, inArray, sql } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import { asset } from '@cms/lib/db/schema'
import { valita } from '@cms/utils/valita'

export type AssetResolution = '@1x' | '@2x' | '@3x'

export type AssetOutputFormat =
  | { type: 'original' }
  | { type: 'gif' }
  | { type: 'png8' }
  | { type: 'png24' }
  | { type: 'jpeg'; quality: number }
  | { type: 'webp'; quality: number }

export type AssetContent = {
  resolution?: AssetResolution
  output_as?: AssetOutputFormat
  width?: number
  height?: number
  maxSize?: { width: number; height: number }
}

export type AssetContentUpdate = {
  [K in keyof AssetContent]?: AssetContent[K] | null
}

const qualityNumber = valita
  .number()
  .assert((n) => Number.isInteger(n) && n >= 50 && n <= 100, 'quality out of range')

export const assetOutputFormatSchema: valita.Type<AssetOutputFormat> = valita.union(
  valita.object({ type: valita.literal('original') }),
  valita.object({ type: valita.literal('gif') }),
  valita.object({ type: valita.literal('png8') }),
  valita.object({ type: valita.literal('png24') }),
  valita.object({ type: valita.literal('jpeg'), quality: qualityNumber }),
  valita.object({ type: valita.literal('webp'), quality: qualityNumber }),
)

const positiveInteger = valita
  .number()
  .assert((n) => Number.isInteger(n) && n > 0, 'must be a positive integer')

export const assetContentSchema: valita.Type<AssetContent> = valita.object({
  resolution: valita
    .union(valita.literal('@1x'), valita.literal('@2x'), valita.literal('@3x'))
    .optional(),
  output_as: assetOutputFormatSchema.optional(),
  width: positiveInteger.optional(),
  height: positiveInteger.optional(),
  maxSize: valita
    .object({ width: positiveInteger, height: positiveInteger })
    .optional(),
})

export type AssetData = {
  id: string
  filename: string
  mime: string
  data: Buffer
  content: AssetContent | null
}

export type AssetPayload = {
  filename: string
  mime: string
  data: Buffer
  content?: AssetContent | null
}

export class AssetStore {
  constructor(private db: Db) {}

  async get(id: string): Promise<AssetData | null> {
    const row = await this.db
      .select({
        id: asset.id,
        filename: asset.filename,
        mime: asset.mime,
        data: asset.data,
        content: asset.content,
      })
      .from(asset)
      .where(eq(asset.id, id))
      .get()
    if (!row || row.id == null) return null
    return {
      id: row.id,
      filename: row.filename,
      mime: row.mime,
      data: row.data,
      content: parseContent(row.content),
    }
  }

  async getContent(ids: string[]): Promise<Record<string, AssetContent | null>> {
    if (ids.length === 0) return {}
    const rows = await this.db
      .select({ id: asset.id, content: asset.content })
      .from(asset)
      .where(inArray(asset.id, ids))
    const result: Record<string, AssetContent | null> = {}
    for (const row of rows) {
      if (row.id != null) result[row.id] = parseContent(row.content)
    }
    return result
  }

  async getSizes(ids: string[]): Promise<Record<string, number>> {
    if (ids.length === 0) return {}
    const rows = await this.db
      .select({ id: asset.id, size: sql<number>`length(${asset.data})` })
      .from(asset)
      .where(inArray(asset.id, ids))
    const result: Record<string, number> = {}
    for (const row of rows) {
      if (row.id != null) result[row.id] = row.size
    }
    return result
  }

  async add(id: string, payload: AssetPayload): Promise<void> {
    await this.db.insert(asset).values({
      id,
      filename: payload.filename,
      mime: payload.mime,
      data: payload.data,
      content: payload.content ? JSON.stringify(payload.content) : null,
    })
  }

  async updateContent(id: string, patch: AssetContentUpdate): Promise<void> {
    const row = await this.db
      .select({ content: asset.content })
      .from(asset)
      .where(eq(asset.id, id))
      .get()
    const existing = row ? parseContent(row.content) : null
    const merged: Record<string, unknown> = { ...(existing ?? {}) }
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete merged[key]
      else if (value !== undefined) merged[key] = value
    }
    await this.db.update(asset).set({ content: JSON.stringify(merged) }).where(eq(asset.id, id))
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(asset).where(eq(asset.id, id))
  }
}

const parseContent = (raw: string | null): AssetContent | null => {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return assetContentSchema.parse(parsed)
  } catch {
    return null
  }
}
