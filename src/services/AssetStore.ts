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

export type AssetImageContent = {
  type: 'image'
  resolution?: AssetResolution
  output_as?: AssetOutputFormat
  width?: number
  height?: number
  maxSize?: { width: number; height: number }
}

export type AssetFileContent = {
  type: 'file'
}

export type AssetContent = AssetImageContent | AssetFileContent

export type AssetContentUpdate = {
  resolution?: AssetResolution | null
  output_as?: AssetOutputFormat | null
  width?: number | null
  height?: number | null
  maxSize?: { width: number; height: number } | null
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

export const assetContentSchema: valita.Type<AssetContent> = valita.union(
  valita.object({
    type: valita.literal('image'),
    resolution: valita
      .union(valita.literal('@1x'), valita.literal('@2x'), valita.literal('@3x'))
      .optional(),
    output_as: assetOutputFormatSchema.optional(),
    width: positiveInteger.optional(),
    height: positiveInteger.optional(),
    maxSize: valita.object({ width: positiveInteger, height: positiveInteger }).optional(),
  }),
  valita.object({ type: valita.literal('file') }),
)

export type AssetData = {
  id: string
  filename: string
  mime: string
  data: Buffer
  content: AssetContent | null
}

export type AssetMeta = {
  id: string
  filename: string
  mime: string
  size: number
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
      content: row.content ? parseContent(row.content) : null,
    }
  }

  /**
   * Everything `get()` returns except the blob itself (plus its byte size).
   * Serving paths that stream from the filesystem cache should use this so a
   * cache hit never deserializes the blob out of SQLite.
   */
  async getMeta(id: string): Promise<AssetMeta | null> {
    const row = await this.db
      .select({
        id: asset.id,
        filename: asset.filename,
        mime: asset.mime,
        size: sql<number>`length(${asset.data})`,
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
      size: row.size,
      content: row.content ? parseContent(row.content) : null,
    }
  }

  async getData(id: string): Promise<Buffer | null> {
    const row = await this.db.select({ data: asset.data }).from(asset).where(eq(asset.id, id)).get()
    return row?.data ?? null
  }

  async getContent(ids: string[]): Promise<Record<string, AssetImageContent>> {
    if (ids.length === 0) return {}
    const rows = await this.db
      .select({ id: asset.id, content: asset.content })
      .from(asset)
      .where(inArray(asset.id, ids))
    const result: Record<string, AssetImageContent> = {}
    for (const row of rows) {
      if (row.id == null || !row.content) continue
      const parsed = parseContent(row.content)
      if (parsed.type === 'image') result[row.id] = parsed
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
    const existing = row?.content ? parseContent(row.content) : null
    const merged: Record<string, unknown> = { ...(existing ?? {}) }
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete merged[key]
      else if (value !== undefined) merged[key] = value
    }
    await this.db
      .update(asset)
      .set({ content: JSON.stringify(merged) })
      .where(eq(asset.id, id))
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(asset).where(eq(asset.id, id))
  }
}

const parseContent = (raw: string): AssetContent => {
  const parsed: unknown = JSON.parse(raw)
  const migrated =
    parsed !== null && typeof parsed === 'object' && !('type' in parsed)
      ? { type: 'image', ...parsed }
      : parsed
  return assetContentSchema.parse(migrated, { mode: 'passthrough' })
}
