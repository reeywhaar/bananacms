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
    const { run } = await import('./dev.ts')
    await run(true)
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
  case 'assets:cleanup': {
    const { values } = parseArgs({
      args: rest,
      options: { 'dry-run': { type: 'boolean', default: false } },
    })
    const { run } = await import('./assetsCleanup.ts')
    await run({ dryRun: values['dry-run'] })
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
  dev                             Boot CMS zone + consumer zone in one process (development)
  start                           Same as dev but in production mode
  build                           Build both zones
  migrate [--force]               Run SQL migrations against DB_PATH
  db:set-user <name> <pw>         Create or update an admin user
  db:seed                         Apply seed/database.sql if DB is absent or empty
  db:cleanup [--dry-run]          Remove orphaned posts / blocks / assets
  db:backfill-image-dimensions [--dry-run]
                                  Populate width/height on image assets via sharp
  assets:cleanup [--dry-run]      Remove files in ASSETS_DIRECTORY with no DB record

Environment (from .env in cwd):
  DB_PATH                         Path to the SQLite database file
  ASSETS_DIRECTORY                Path to the asset storage directory
  BANANACMS_HOST                  Public host used to build NEXT_PUBLIC_SERVER_URL in dev/start (default: localhost). CMS_INTERNAL_URL is always bound to localhost.
  BANANACMS_CONFIG_MODULE         Path to the consumer's createCMS() module, relative to cwd (default: src/cms.ts). Both zones side-effect-import this at boot.
  SERVER_PORT                     Public-zone port (default: 3000). CMS zone runs on SERVER_PORT + 1.
`)
}
