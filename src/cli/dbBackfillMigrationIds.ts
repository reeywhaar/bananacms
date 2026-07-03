import { existsSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDb } from '@cms/lib/db/client'

const MIGRATION_FILE_RE = /^(\d+)_(.+)\.(ts|js)$/

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`${name} is not set. Provide it via .env or the environment.`)
    process.exit(1)
  }
  return v
}

function loadNameToId(migrationsPath: string): Map<string, number> {
  const map = new Map<string, number>()
  if (!existsSync(migrationsPath)) return map
  const files = readdirSync(migrationsPath).filter(
    (f) => MIGRATION_FILE_RE.test(f) && !f.endsWith('.d.ts'),
  )
  for (const file of files) {
    const match = MIGRATION_FILE_RE.exec(file)
    if (!match) continue
    map.set(match[2], Number(match[1]))
  }
  return map
}

export async function run({ dryRun = false }: { dryRun?: boolean } = {}): Promise<void> {
  const dataPath = requireEnv('DATA_PATH')
  const dbPath = join(dataPath, 'database.db')
  const { client } = await openDb(dbPath)

  // Build name→newId mapping from both CMS and client migration directories.
  const cmsMigrationsPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'lib',
    'migrations',
  )
  const clientMigrationsPath = join(process.cwd(), 'src', 'lib', 'migrations')
  const nameToId = new Map([
    ...loadNameToId(cmsMigrationsPath),
    ...loadNameToId(clientMigrationsPath),
  ])

  const rows = (await client.execute('SELECT id, name FROM migrations')).rows

  let updated = 0
  for (const row of rows) {
    const currentId = Number(row.id)
    const name = String(row.name)
    const expectedId = nameToId.get(name)

    if (expectedId === undefined) {
      console.warn(`  SKIP  id=${currentId} name=${name} — no matching migration file found`)
      continue
    }

    if (currentId === expectedId) {
      console.info(`  OK    id=${currentId} name=${name}`)
      continue
    }

    console.info(
      `  UPDATE id=${currentId} → ${expectedId} name=${name}${dryRun ? ' (dry-run)' : ''}`,
    )
    if (!dryRun) {
      await client.execute({
        sql: 'UPDATE migrations SET id = ? WHERE name = ?',
        args: [expectedId, name],
      })
    }
    updated++
  }

  client.close()
  console.info(`\nbananacms: ${dryRun ? 'would update' : 'updated'} ${updated} migration id(s).`)
}
