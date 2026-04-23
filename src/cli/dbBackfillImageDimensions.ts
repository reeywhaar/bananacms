import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { openDb } from '@cms/lib/db/client'

export async function run({ dryRun }: { dryRun: boolean }): Promise<void> {
  const dbPath = requireEnv('DB_PATH')
  const assetsDir = process.env.ASSETS_DIRECTORY

  const { client } = openDb(dbPath)

  const rows = (
    await client.execute(`
      SELECT id FROM asset
        WHERE mime LIKE 'image/%'
          AND (json_extract(content, '$.width') IS NULL
            OR json_extract(content, '$.height') IS NULL)
    `)
  ).rows.map((r) => String(r.id))

  console.info(`Found ${rows.length} image asset(s) missing dimensions.`)

  let updated = 0
  let failed = 0

  for (const id of rows) {
    try {
      let buf: Buffer | null = null
      if (assetsDir) {
        try {
          buf = await readFile(join(assetsDir, id))
        } catch {
          // fall through to DB blob
        }
      }
      if (!buf) {
        const r = await client.execute({
          sql: 'SELECT data FROM asset WHERE id = ?',
          args: [id],
        })
        const data = r.rows[0]?.data
        buf = data instanceof Uint8Array ? Buffer.from(data) : null
      }
      if (!buf) {
        console.warn(`  skip ${id}: no data available`)
        failed++
        continue
      }

      const meta = await sharp(buf).metadata()
      const width = meta.autoOrient?.width ?? meta.width
      const height = meta.autoOrient?.height ?? meta.height
      if (!width || !height) {
        console.warn(`  skip ${id}: sharp returned no dimensions`)
        failed++
        continue
      }

      console.info(`  ${id}: ${width} × ${height}`)
      if (!dryRun) {
        await client.execute({
          sql: `UPDATE asset
                  SET content = json_set(COALESCE(content, '{}'), '$.width', ?, '$.height', ?)
                WHERE id = ?`,
          args: [width, height, id],
        })
      }
      updated++
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.warn(`  fail ${id}: ${message}`)
      failed++
    }
  }

  client.close()
  console.info(`${dryRun ? '[dry-run] ' : ''}Updated ${updated}, failed ${failed}.`)
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`${name} is not set. Provide it via .env or the environment.`)
    process.exit(1)
  }
  return v
}
