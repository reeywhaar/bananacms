import { lstat, readdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { assetsDirectory, openSiteDatabases } from './site-databases.ts'

// Deletes the files in ASSETS_DIRECTORY that belong to no asset in the database: the
// cached originals, named <id>, and the image variants, named <id>-<hash>. Links go
// too, like a variant that links to its original. With `dryRun`, it only lists them.
export async function cleanupAssets(
  root: string,
  options: { dryRun?: boolean } = {},
): Promise<{ kept: number; removed: number }> {
  const dir = assetsDirectory(root)
  if (!dir) throw new Error('ASSETS_DIRECTORY is not set')
  const ids = await (async () => {
    using databases = await openSiteDatabases(root)
    const rows = (await databases.main.client.execute('SELECT id FROM asset')).rows
    return new Set(rows.map((row) => String(row.id)))
  })()

  let kept = 0
  let removed = 0
  for (const name of await readdir(dir)) {
    const file = path.join(dir, name)
    const stat = await lstat(file).catch(() => undefined)
    if (!stat || !(stat.isFile() || stat.isSymbolicLink())) continue
    if (belongsToAsset(name, ids)) {
      kept++
      continue
    }
    console.info(`  remove ${name}`)
    if (!options.dryRun) {
      await unlink(file).catch((error: unknown) => {
        console.warn(`    failed: ${error instanceof Error ? error.message : String(error)}`)
      })
    }
    removed++
  }
  console.info(`${options.dryRun ? '[dry run] ' : ''}Kept ${kept}, removed ${removed}.`)
  return { kept, removed }
}

// <id>, or <id>-<anything>: asset ids have dashes too, so each one is a place the
// id could end
function belongsToAsset(name: string, ids: Set<string>): boolean {
  if (ids.has(name)) return true
  for (let dash = name.indexOf('-'); dash !== -1; dash = name.indexOf('-', dash + 1)) {
    if (ids.has(name.slice(0, dash))) return true
  }
  return false
}
