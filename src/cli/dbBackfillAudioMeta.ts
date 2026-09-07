import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { openDb } from '@cms/lib/db/client'
import { readAudioMeta, describeAudio } from '@cms/lib/audioMeta'

export async function run({ dryRun }: { dryRun: boolean }): Promise<void> {
  const dataPath = requireEnv('DATA_PATH')
  const dbPath = join(dataPath, 'database.db')
  const assetsDir = process.env.ASSETS_DIRECTORY

  const { client } = await openDb(dbPath)

  // Anything that is audio but has no duration recorded: assets uploaded
  // before this existed, and any whose file could not be read at the time.
  const rows = (
    await client.execute(`
      SELECT id FROM asset
        WHERE mime LIKE 'audio/%'
          AND json_extract(content, '$.duration') IS NULL
    `)
  ).rows.map((r) => String(r.id))

  console.info(`Found ${rows.length} audio asset(s) missing metadata.`)

  let updated = 0
  let failed = 0

  for (const id of rows) {
    try {
      const buf = await readAssetBytes(client, assetsDir, id)
      if (!buf) {
        console.warn(`  skip ${id}: no data available`)
        failed++
        continue
      }

      const mime = String(
        (await client.execute({ sql: 'SELECT mime FROM asset WHERE id = ?', args: [id] })).rows[0]
          ?.mime ?? '',
      )
      const meta = await readAudioMeta(buf, mime || undefined)
      if (!meta) {
        console.warn(`  skip ${id}: not readable as audio`)
        failed++
        continue
      }

      console.info(`  ${id}: ${describeAudio(meta) || '(no technical metadata)'}`)
      if (!dryRun) {
        // Merged into whatever is already there rather than replacing it, so a
        // `type` (or anything an editor set) survives the backfill.
        await client.execute({
          sql: `UPDATE asset
                  SET content = json_patch(COALESCE(content, '{}'), ?)
                WHERE id = ?`,
          args: [JSON.stringify({ type: 'audio', ...meta }), id],
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

/** The cached original on disk if it is there, else the blob in the database. */
async function readAssetBytes(
  client: Awaited<ReturnType<typeof openDb>>['client'],
  assetsDir: string | undefined,
  id: string,
): Promise<Buffer | null> {
  if (assetsDir) {
    const cached = await readFile(join(assetsDir, id)).catch(() => null)
    if (cached) return cached
  }
  // asset_blob, not asset: the blob lives in a sibling table so metadata reads
  // never walk its overflow pages.
  const row = (
    await client.execute({ sql: 'SELECT data FROM asset_blob WHERE id = ?', args: [id] })
  ).rows[0]
  const data = row?.data
  return data instanceof Uint8Array ? Buffer.from(data) : null
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`${name} is not set. Provide it via .env or the environment.`)
    process.exit(1)
  }
  return v
}
