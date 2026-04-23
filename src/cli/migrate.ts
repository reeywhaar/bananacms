import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { openDb, runMigrations } from '@cms/lib/db/client'

export async function run({ force = false }: { force?: boolean }): Promise<void> {
  const dbPath = requireEnv('DB_PATH')

  await mkdir(resolve(dbPath, '..'), { recursive: true })

  const { client } = openDb(dbPath)

  console.info(`bananacms: running migrations on ${dbPath}${force ? ' (force)' : ''}...`)
  await runMigrations(client, { force })

  const violations = (await client.execute('PRAGMA foreign_key_check')).rows
  if (violations.length > 0) {
    console.error('Foreign key violations after migration:')
    console.error(violations)
    client.close()
    process.exit(1)
  }

  client.close()
  console.info('bananacms: migrations complete.')
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`${name} is not set. Provide it via .env or the environment.`)
    process.exit(1)
  }
  return v
}
