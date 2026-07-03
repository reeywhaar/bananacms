import { join } from 'node:path'
import { openDb, openDerivedDb, runMigrations } from '@cms/lib/db/client'
import { post } from '@cms/lib/db/schema'
import { PostSearchStore } from '@cms/services/PostSearchStore'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`Error: ${name} environment variable is not set`)
    process.exit(1)
  }
  return value
}

export async function run(): Promise<void> {
  const dataPath = requireEnv('DATA_PATH')
  const dbPath = join(dataPath, 'database.db')
  const derivedDbPath = join(dataPath, 'derived.db')
  const { client, db } = openDb(dbPath)
  const { client: derivedClient } = openDerivedDb(derivedDbPath)

  await runMigrations(client, derivedClient)

  const postIds = (await db.select({ id: post.id }).from(post)).map((r) => r.id)
  console.info(`Indexing ${postIds.length} post(s)...`)

  const store = new PostSearchStore(db)
  let done = 0
  for (const id of postIds) {
    await store.rebuildPostIndex(id)
    done++
    if (done % 50 === 0) console.info(`  ${done}/${postIds.length}`)
  }

  console.info(`Done. Indexed ${done} post(s).`)
}
