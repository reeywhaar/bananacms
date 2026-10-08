import sharp from 'sharp'
import { createMigration } from './migration.ts'

// Stores the size of each image uploaded before an upload stored it, as read
// from its file. Until it had one, getImagesMetadata stored an image's size as a
// page showing it rendered, so the database changed under the site's visitors,
// and each change made a backup and a snapshot. The files are read one at a
// time. An image sharp can't read is left without one.
export default createMigration({
  async up(tx) {
    const { rows } = await tx.execute(`
SELECT id, content FROM asset
 WHERE mime LIKE 'image/%'
   AND coalesce(json_extract(content, '$.type'), 'image') = 'image'
   AND (json_extract(content, '$.width') IS NULL OR json_extract(content, '$.height') IS NULL)
    `)
    for (const row of rows) {
      const id = String(row.id)
      const blob = await tx.execute({ sql: 'SELECT data FROM asset_blob WHERE id = ?', args: [id] })
      const size = await measure(blob.rows[0]?.data)
      if (!size) continue
      const content: Record<string, unknown> = row.content ? JSON.parse(String(row.content)) : {}
      await tx.execute({
        sql: 'UPDATE asset SET content = ? WHERE id = ?',
        args: [JSON.stringify({ ...content, ...size }), id],
      })
    }
  },

  // The sizes stay: an upload stores them too, and they're read the same way.
  async down() {},
})

// an image's size as it shows, turned as its EXIF says, as an upload measures it
async function measure(data: unknown): Promise<{ width: number; height: number } | null> {
  if (!(data instanceof ArrayBuffer || data instanceof Uint8Array)) return null
  try {
    const meta = await sharp(data).metadata()
    const width = meta.autoOrient?.width ?? meta.width
    const height = meta.autoOrient?.height ?? meta.height
    return width && height ? { width, height } : null
  } catch {
    return null
  }
}
