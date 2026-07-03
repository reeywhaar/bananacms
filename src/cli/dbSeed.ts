import fs from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDb, openDerivedDb, runMigrations } from '@cms/lib/db/client'

export async function run(): Promise<void> {
  const dataPath = requireEnv('DATA_PATH')
  const dbPath = join(dataPath, 'database.db')
  const derivedDbPath = join(dataPath, 'derived.db')
  const seedPath = fileURLToPath(new URL('../../seed/database.sql', import.meta.url))

  if (!fs.existsSync(seedPath)) {
    console.error(`Seed file not found: ${seedPath}`)
    process.exit(1)
  }

  const { client } = openDb(dbPath)
  const { client: derivedClient } = openDerivedDb(derivedDbPath)

  try {
    const result = await client.execute(
      `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
    )
    const n = Number(result.rows[0]?.n ?? 0)
    if (n > 0) {
      console.info(`Database already has ${n} table(s); skipping seed.`)
    } else {
      const sql = fs.readFileSync(seedPath, 'utf-8')
      await client.executeMultiple(sql)
      console.info(`Seeded database from ${seedPath}`)
    }

    await runMigrations(client, derivedClient)
  } finally {
    client.close()
    derivedClient.close()
  }
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`${name} is not set. Provide it via .env or the environment.`)
    process.exit(1)
  }
  return v
}
