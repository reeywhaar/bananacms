import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'
import sharp from 'sharp'

export async function run({ dryRun }: { dryRun: boolean }): Promise<void> {
  const dbPath = requireEnv('DB_PATH')
  const assetsDir = process.env.ASSETS_DIRECTORY

  const db = await open({ filename: dbPath, driver: sqlite3.Database })

  const rows = await db.all<{ id: string }[]>(
    `SELECT id FROM asset
      WHERE mime LIKE 'image/%'
        AND (json_extract(content, '$.width') IS NULL
          OR json_extract(content, '$.height') IS NULL)`,
  )

  console.info(`Found ${rows.length} image asset(s) missing dimensions.`)

  let updated = 0
  let failed = 0

  for (const row of rows) {
    try {
      let buf: Buffer | null = null
      if (assetsDir) {
        try {
          buf = await readFile(join(assetsDir, row.id))
        } catch {
          // fall through to DB blob
        }
      }
      if (!buf) {
        const r = await db.get<{ data: Buffer | null }>('SELECT data FROM asset WHERE id = ?', row.id)
        buf = r?.data ?? null
      }
      if (!buf) {
        console.warn(`  skip ${row.id}: no data available`)
        failed++
        continue
      }

      const meta = await sharp(buf).metadata()
      const width = meta.autoOrient?.width ?? meta.width
      const height = meta.autoOrient?.height ?? meta.height
      if (!width || !height) {
        console.warn(`  skip ${row.id}: sharp returned no dimensions`)
        failed++
        continue
      }

      console.info(`  ${row.id}: ${width} × ${height}`)
      if (!dryRun) {
        await db.run(
          `UPDATE asset
              SET content = json_set(COALESCE(content, '{}'), '$.width', ?, '$.height', ?)
            WHERE id = ?`,
          width,
          height,
          row.id,
        )
      }
      updated++
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.warn(`  fail ${row.id}: ${message}`)
      failed++
    }
  }

  await db.close()
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
