import { Database } from 'sqlite'
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

type AssetRow = {
  id: string
  filename: string
  mime: string
  data: Buffer
  content: string | null
}

export class AssetStore {
  constructor(private db: Database) {}

  async get(id: string): Promise<AssetData | null> {
    const row = await this.db.get<AssetRow>(
      'SELECT id, filename, mime, data, content FROM asset WHERE id = ?',
      id,
    )
    if (!row) return null
    return { ...row, content: parseContent(row.content) }
  }

  async getContent(ids: string[]): Promise<Record<string, AssetContent | null>> {
    if (ids.length === 0) return {}
    const placeholders = ids.map(() => '?').join(', ')
    const rows = await this.db.all<{ id: string; content: string | null }[]>(
      `SELECT id, content FROM asset WHERE id IN (${placeholders})`,
      ...ids,
    )
    const result: Record<string, AssetContent | null> = {}
    for (const row of rows) result[row.id] = parseContent(row.content)
    return result
  }

  async getSizes(ids: string[]): Promise<Record<string, number>> {
    if (ids.length === 0) return {}
    const placeholders = ids.map(() => '?').join(', ')
    const rows = await this.db.all<{ id: string; size: number }[]>(
      `SELECT id, length(data) AS size FROM asset WHERE id IN (${placeholders})`,
      ...ids,
    )
    const result: Record<string, number> = {}
    for (const row of rows) result[row.id] = row.size
    return result
  }

  async add(id: string, payload: AssetPayload): Promise<void> {
    await this.db.run(
      'INSERT INTO asset (id, filename, mime, data, content) VALUES (?, ?, ?, ?, ?)',
      id,
      payload.filename,
      payload.mime,
      payload.data,
      payload.content ? JSON.stringify(payload.content) : null,
    )
  }

  async updateContent(id: string, patch: AssetContentUpdate): Promise<void> {
    const row = await this.db.get<{ content: string | null }>(
      'SELECT content FROM asset WHERE id = ?',
      id,
    )
    const existing = row ? parseContent(row.content) : null
    const merged: Record<string, unknown> = { ...(existing ?? {}) }
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete merged[key]
      else if (value !== undefined) merged[key] = value
    }
    await this.db.run(
      'UPDATE asset SET content = ? WHERE id = ?',
      JSON.stringify(merged),
      id,
    )
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM asset WHERE id = ?', id)
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
