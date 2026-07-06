#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { loadEnvFile } from 'node:process'

try {
  loadEnvFile(process.cwd() + '/.env')
} catch {
  // .env is optional — environment may provide vars directly
}

const [, , command, ...rest] = process.argv

if (!command) {
  printHelp()
  process.exit(1)
}

switch (command) {
  case 'dev': {
    const { values } = parseArgs({
      args: rest,
      options: { 'watch-cms': { type: 'boolean', default: false } },
    })
    const { run } = await import('./dev.ts')
    await run(true, { watchCms: values['watch-cms'] })
    break
  }
  case 'start': {
    const { run } = await import('./dev.ts')
    await run(false)
    break
  }
  case 'build': {
    const { run } = await import('./build.ts')
    await run()
    break
  }
  case 'migrate': {
    const { values } = parseArgs({
      args: rest,
      options: { force: { type: 'boolean', default: false } },
    })
    const { run } = await import('./migrate.ts')
    await run({ force: values.force })
    break
  }
  case 'db:add-migration': {
    const { run } = await import('./dbAddMigration.ts')
    await run()
    break
  }
  case 'db:set-user': {
    const { positionals } = parseArgs({ args: rest, allowPositionals: true })
    const [name, password] = positionals
    if (!name || !password) {
      console.error('Usage: bananacms db:set-user <name> <password>')
      process.exit(1)
    }
    const { run } = await import('./dbSetUser.ts')
    await run({ name, password })
    break
  }
  case 'db:seed': {
    const { run } = await import('./dbSeed.ts')
    await run()
    break
  }
  case 'db:cleanup': {
    const { values } = parseArgs({
      args: rest,
      options: { 'dry-run': { type: 'boolean', default: false } },
    })
    const { run } = await import('./dbCleanup.ts')
    await run({ dryRun: values['dry-run'] })
    break
  }
  case 'db:backfill-image-dimensions': {
    const { values } = parseArgs({
      args: rest,
      options: { 'dry-run': { type: 'boolean', default: false } },
    })
    const { run } = await import('./dbBackfillImageDimensions.ts')
    await run({ dryRun: values['dry-run'] })
    break
  }
  case 'db:backfill-post-fts': {
    const { run } = await import('./dbBackfillPostFts.ts')
    await run()
    break
  }
  case 'db:backfill-migration-ids': {
    const { values } = parseArgs({
      args: rest,
      options: { 'dry-run': { type: 'boolean', default: false } },
    })
    const { run } = await import('./dbBackfillMigrationIds.ts')
    await run({ dryRun: values['dry-run'] })
    break
  }
  case 'assets:cleanup': {
    const { values } = parseArgs({
      args: rest,
      options: { 'dry-run': { type: 'boolean', default: false } },
    })
    const { run } = await import('./assetsCleanup.ts')
    await run({ dryRun: values['dry-run'] })
    break
  }
  case 'snapshot': {
    const { values, positionals } = parseArgs({
      args: rest,
      options: { raw: { type: 'boolean', default: false } },
      allowPositionals: true,
    })
    const [action, indexStr] = positionals
    if (action !== 'list' && action !== 'view' && action !== 'restore') {
      console.error('Usage: bananacms snapshot <list|view|restore> [index] [--raw]')
      process.exit(1)
    }
    let index: number | undefined
    if (action === 'view' || action === 'restore') {
      index = Number.parseInt(indexStr ?? '', 10)
      if (!Number.isInteger(index) || index < 1) {
        console.error(`Usage: bananacms snapshot ${action} <index>   (1 = newest snapshot)`)
        process.exit(1)
      }
    }
    const { run } = await import('./snapshot.ts')
    await run({ action, index, raw: values.raw })
    break
  }
  case 'help':
  case '--help':
  case '-h': {
    printHelp()
    break
  }
  default:
    console.error(`bananacms: unknown command "${command}"`)
    printHelp()
    process.exit(1)
}

function printHelp(): void {
  console.info(`bananacms CLI — run from inside your consumer (demo) directory

Usage: bananacms <command> [options]

Commands:
  dev [--watch-cms]               Boot CMS zone + consumer zone in one process (development).
                                  Pass --watch-cms when developing the CMS package source itself
                                  (rebuilds dist/ on change so the consumer sees fresh types).
  start                           Same as dev but in production mode
  build                           Build both zones
  migrate [--force]               Run SQL migrations against DATA_PATH/database.db
  db:add-migration                Create a new client migration file in src/lib/migrations/
  db:set-user <name> <pw>         Create or update an admin user
  db:seed                         Apply seed/database.sql if DB is absent or empty
  db:cleanup [--dry-run]          Remove orphaned posts / blocks / assets
  db:backfill-image-dimensions [--dry-run]
                                  Populate width/height on image assets via sharp
  db:backfill-post-fts            Build post_fts search index for all existing posts
  db:backfill-migration-ids [--dry-run]
                                  Convert old sequential migration IDs in the DB table to the
                                  new 12-digit timestamp-based IDs from migration files
  assets:cleanup [--dry-run]      Remove files in ASSETS_DIRECTORY with no DB record
  snapshot list                   List database snapshots in DATA_PATH/snapshots (1 = newest)
  snapshot view <n> [--raw]       Print snapshot <n> as SQL (--raw prints the stored file,
                                  which is a diff for all but the oldest snapshot)
  snapshot restore <n>            Replace DATA_PATH/database.db with snapshot <n>. The app
                                  must be stopped (refuses while the .pid file marks it
                                  running on this host); the current state is snapshotted
                                  first.

Environment (from .env in cwd):
  DATA_PATH                       Path to the data directory (database stored as database.db inside)
  ASSETS_DIRECTORY                Path to the asset storage directory
  BANANACMS_HOST                  Public host used to build NEXT_PUBLIC_SERVER_URL in dev/start (default: localhost). CMS_INTERNAL_URL is always bound to localhost.
  BANANACMS_CONFIG_MODULE         Path to the consumer's createCMS() module, relative to cwd (default: src/cms.ts). Both zones side-effect-import this at boot.
  SERVER_PORT                     Public port (default: 3000), served by the front server (asset
                                  fast path + proxy) — point your reverse proxy here. The CMS zone
                                  runs on SERVER_PORT + 1, the consumer zone on SERVER_PORT + 2.
  SNAPSHOTS_COUNT                 Enable automatic DB snapshots and keep at most this many
                                  (0 or unset disables). Snapshots are taken at app start and
                                  after each burst of writes, into DATA_PATH/snapshots.
  SNAPSHOTS_DELAY                 Seconds between the first write and the snapshot capturing
                                  it (default: 600)
`)
}
