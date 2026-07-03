import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { openDb, openDerivedDb, runMigrations } from '@cms/lib/db/client'

export async function run({ force = false }: { force?: boolean }): Promise<void> {
  const dataPath = requireEnv('DATA_PATH')
  const dbPath = join(dataPath, 'database.db')
  const derivedDbPath = join(dataPath, 'derived.db')

  await mkdir(resolve(dataPath), { recursive: true })

  const { client } = openDb(dbPath)
  const { client: derivedClient } = openDerivedDb(derivedDbPath)

  console.info(`bananacms: running migrations on ${dbPath}${force ? ' (force)' : ''}...`)
  await runMigrations(client, derivedClient, { force })

  const violations = (await client.execute('PRAGMA foreign_key_check')).rows
  if (violations.length > 0) {
    console.error('Foreign key violations after migration:')
    console.error(violations)
    client.close()
    derivedClient.close()
    process.exit(1)
  }

  client.close()
  derivedClient.close()
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
