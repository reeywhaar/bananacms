import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import {
  loadMigrations,
  openDb,
  openDerivedDb,
  runMigrations,
  type Db,
  type DerivedDb,
} from '../lib/db/client.ts'
import type { Client } from '@libsql/client'

export type SiteDatabases = {
  main: { client: Client; db: Db }
  derived: { client: Client; db: DerivedDb }
  [Symbol.dispose](): void
}

// A site's databases, database.db and derived.db in its DATA_PATH, for a CLI
// command. With `migrate`, they're created if need be and migrated, the site's
// own migrations in src/lib/migrations included. Without it they must exist
// already. `using databases = await openSiteDatabases(root)` closes them.
export async function openSiteDatabases(
  root: string,
  options: { migrate?: boolean; force?: boolean } = {},
): Promise<SiteDatabases> {
  const dir = dataPath(root)
  const mainFile = path.join(dir, 'database.db')
  if (options.migrate) await mkdir(dir, { recursive: true })
  else if (!existsSync(mainFile)) {
    throw new Error(`No database at ${mainFile}: run \`bananacms db migration run\` to create it`)
  }
  const main = await openDb(mainFile)
  const derived = await openDerivedDb(path.join(dir, 'derived.db'))
  const databases: SiteDatabases = {
    main,
    derived,
    [Symbol.dispose]() {
      main.client.close()
      derived.client.close()
    },
  }
  try {
    if (options.migrate) {
      await runMigrations(main.client, derived.client, {
        force: options.force,
        siteMigrations: await loadMigrations(siteMigrationsPath(root)),
      })
    }
  } catch (error) {
    databases[Symbol.dispose]()
    throw error
  }
  return databases
}

// The site's databases for its own Node scripts, the handles pages get from
// getDb(ctx) and getDerivedDb(ctx), in `root`'s DATA_PATH. They must exist:
// `bananacms db migration run` makes them. `using databases = await
// openDatabases()` closes them.
export async function openDatabases(
  root: string = process.cwd(),
): Promise<{ db: Db; derivedDb: DerivedDb; [Symbol.dispose](): void }> {
  const databases = await openSiteDatabases(root)
  return {
    db: databases.main.db,
    derivedDb: databases.derived.db,
    [Symbol.dispose]: () => databases[Symbol.dispose](),
  }
}

export function siteMigrationsPath(root: string): string {
  return path.join(root, 'src/lib/migrations')
}

// DATA_PATH, relative to the site's directory
export function dataPath(root: string): string {
  const dataPath = process.env.DATA_PATH
  if (!dataPath) {
    throw new Error(
      'DATA_PATH is not set: point it at a directory for the databases, e.g. ./private',
    )
  }
  return path.resolve(root, dataPath)
}

// ASSETS_DIRECTORY, relative to the site's directory, or undefined when it's not set
export function assetsDirectory(root: string): string | undefined {
  const assetsDirectory = process.env.ASSETS_DIRECTORY
  return assetsDirectory ? path.resolve(root, assetsDirectory) : undefined
}
