import { readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { openDb } from '@cms/lib/db/client'

export async function run({ dryRun }: { dryRun: boolean }): Promise<void> {
  const dataPath = requireEnv('DATA_PATH')
  const dbPath = join(dataPath, 'database.db')
  const assetsDir = requireEnv('ASSETS_DIRECTORY')

  const { client } = openDb(dbPath)
  const rows = (await client.execute('SELECT id FROM asset')).rows
  client.close()

  const assetIds = new Set(rows.map((r) => String(r.id)))
  const entries = await readdir(assetsDir)

  let removed = 0
  let kept = 0

  for (const name of entries) {
    const path = join(assetsDir, name)
    const s = await stat(path).catch(() => null)
    if (!s || !s.isFile()) continue

    if (belongsToAsset(name, assetIds)) {
      kept++
      continue
    }

    console.info(`  remove ${name}`)
    if (!dryRun) {
      await unlink(path).catch((e) => {
        const message = e instanceof Error ? e.message : String(e)
        console.warn(`    fail: ${message}`)
      })
    }
    removed++
  }

  console.info(
    `${dryRun ? '[dry-run] ' : ''}Kept ${kept}, removed ${removed} of ${entries.length} entries.`,
  )
}

function belongsToAsset(filename: string, ids: Set<string>): boolean {
  if (ids.has(filename)) return true
  let idx = filename.indexOf('-')
  while (idx !== -1) {
    if (ids.has(filename.slice(0, idx))) return true
    idx = filename.indexOf('-', idx + 1)
  }
  return false
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`${name} is not set. Provide it via .env or the environment.`)
    process.exit(1)
  }
  return v
}
