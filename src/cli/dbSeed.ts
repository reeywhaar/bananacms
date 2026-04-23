import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'

export async function run(): Promise<void> {
  const dbPath = requireEnv('DB_PATH')
  const seedPath = fileURLToPath(new URL('../../seed/database.sql', import.meta.url))

  if (!fs.existsSync(seedPath)) {
    console.error(`Seed file not found: ${seedPath}`)
    process.exit(1)
  }

  const db = await open({ filename: dbPath, driver: sqlite3.Database })

  try {
    const row = await db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
    )
    if (row && row.n > 0) {
      console.info(`Database already has ${row.n} table(s); skipping seed.`)
      return
    }

    const sql = fs.readFileSync(seedPath, 'utf-8')
    await db.exec(sql)
    console.info(`Seeded database from ${seedPath}`)
  } finally {
    await db.close()
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
