import { Command, Help, InvalidArgumentError } from 'commander'
import pkg from '../../package.json' with { type: 'json' }

// Commands run in the site directory. Its .env is optional:
// the environment may provide the variables instead.
try {
  process.loadEnvFile('.env')
} catch {}

const program = new Command()
  .name('bananacms')
  .description('Run a bananacms site: its pages plus the CMS admin at /manage.')
  .version(pkg.version)
  // a group shows as `db [command]` in the lists, as in its own usage line
  .configureHelp({
    subcommandTerm: (cmd) => {
      const term = new Help().subcommandTerm(cmd)
      return cmd.commands.length > 0 ? `${term} [command]` : term
    },
  })

program
  .command('dev')
  .description('start the dev server with hot reload')
  .option('-p, --port <port>', 'port to listen on (default: 5173)', parsePort)
  .option('--host [host]', 'listen on all addresses, or on the given one')
  .action(async (options: { port?: number; host?: string | true }) => {
    const { dev } = await import('./dev.ts')
    await dev(process.cwd(), options)
  })

program
  .command('build')
  .description('build the site for production into dist/')
  .action(async () => {
    const { build } = await import('./build.ts')
    await build(process.cwd())
  })

program
  .command('start')
  .description('serve the production build from dist/')
  .option('-p, --port <port>', 'port to listen on (default: $PORT or 3000)', parsePort)
  .option('--host <host>', 'address to listen on')
  .action(async (options: { port?: number; host?: string }) => {
    const { start } = await import('./start.ts')
    await start(process.cwd(), options)
  })

const db = program
  .command('db')
  .description("the site's databases: migrations, clean-ups and backfills")

const migration = db
  .command('migration')
  .description("the CMS's and the site's migrations (docs/migrations.md)")

migration
  .command('run')
  .description("run the CMS's and the site's migrations that haven't run yet")
  .option(
    '--force',
    "run every migration's down first, newest first, then every up: it can drop data",
  )
  .action(async (options: { force?: boolean }) => {
    const { migrate } = await import('./migrate.ts')
    await migrate(process.cwd(), options)
  })

migration
  .command('check')
  .description(
    'fail unless the databases are what the migrations make: all run, none unknown, the same schema',
  )
  .action(async () => {
    const { checkMigrations } = await import('./migrate.ts')
    await checkMigrations(process.cwd())
  })

migration
  .command('create')
  .description('create a migration for the site, src/lib/migrations/<Date.now()>_<name>.ts')
  .argument('<name>', 'the name, in snake_case')
  .action(async (name: string) => {
    const { addMigration } = await import('./migrate.ts')
    await addMigration(process.cwd(), name)
  })

db.command('cleanup')
  .description('delete posts in no category, and blocks, attributes and assets that nothing uses')
  .option('--dry-run', 'list them, and change nothing')
  .action(async (options: { dryRun?: boolean }) => {
    const { cleanupDatabase } = await import('./db-cleanup.ts')
    await cleanupDatabase(process.cwd(), options)
  })

const backfill = db
  .command('backfill')
  .description('fill in what databases from older versions lack; each can run while the site does')

backfill
  .command('image-dimensions')
  .description('fill in the width and height of image assets that have none')
  .option('--dry-run', 'list them, and change nothing')
  .action(async (options: { dryRun?: boolean }) => {
    const { backfillImageDimensions } = await import('./db-backfill.ts')
    await backfillImageDimensions(process.cwd(), options)
  })

backfill
  .command('audio-meta')
  .description("fill in audio assets' duration, bitrate, sample rate, channels, codec and tags")
  .option('--dry-run', 'list them, and change nothing')
  .action(async (options: { dryRun?: boolean }) => {
    const { backfillAudioMeta } = await import('./db-backfill.ts')
    await backfillAudioMeta(process.cwd(), options)
  })

backfill
  .command('post-fts')
  .description('build the search index of every post again')
  .action(async () => {
    const { backfillPostFts } = await import('./db-backfill.ts')
    await backfillPostFts(process.cwd())
  })

backfill
  .command('migration-ids')
  .description('give the migrations table the ids the migration files have, for an older database')
  .option('--dry-run', 'list them, and change nothing')
  .action(async (options: { dryRun?: boolean }) => {
    const { backfillMigrationIds } = await import('./db-backfill.ts')
    await backfillMigrationIds(process.cwd(), options)
  })

const user = program.command('user').description('the CMS users, who sign in at /manage')

user
  .command('create')
  .description('invite a user: print a link where they set a password, which creates them')
  .argument('<name>', 'the name they sign in with')
  .action(async (name: string) => {
    const { createUser } = await import('./user.ts')
    await createUser(process.cwd(), name)
  })

user
  .command('reset')
  .description('print a link where a user sets a new password; the old one works until then')
  .argument('<name>', 'the name they sign in with')
  .action(async (name: string) => {
    const { resetUser } = await import('./user.ts')
    await resetUser(process.cwd(), name)
  })

program
  .command('assets')
  .description('the files in ASSETS_DIRECTORY')
  .command('cleanup')
  .description('delete the files that belong to no asset')
  .option('--dry-run', 'list them, and change nothing')
  .action(async (options: { dryRun?: boolean }) => {
    const { cleanupAssets } = await import('./assets-cleanup.ts')
    await cleanupAssets(process.cwd(), options)
  })

const snapshot = program
  .command('snapshot')
  .description('list, view or restore the snapshots of database.db, in DATA_PATH/snapshots')

snapshot
  .command('list')
  .description('list the snapshots, 1 being the newest')
  .action(async () => {
    const { listSnapshotsCommand } = await import('./snapshot.ts')
    await listSnapshotsCommand(process.cwd())
  })

snapshot
  .command('view')
  .description('print a snapshot as the SQL that makes the database')
  .argument('<n>', 'the snapshot, 1 being the newest', parseIndex)
  .option('--raw', 'print its file as it is: a diff, for all but the oldest')
  .action(async (index: number, options: { raw?: boolean }) => {
    const { viewSnapshot } = await import('./snapshot.ts')
    await viewSnapshot(process.cwd(), index, options)
  })

snapshot
  .command('restore')
  .description(
    'replace database.db with a snapshot, snapshotting the current one first; the site must be stopped',
  )
  .argument('<n>', 'the snapshot, 1 being the newest', parseIndex)
  .action(async (index: number) => {
    const { restoreSnapshot } = await import('./snapshot.ts')
    await restoreSnapshot(process.cwd(), index)
  })

program
  .command('backup')
  .description('back the databases up to BACKUP_URL')
  .command('now')
  .description('back up now, whether or not anything changed; the site can be running')
  .action(async () => {
    const { backupNow } = await import('./snapshot.ts')
    await backupNow(process.cwd())
  })

// A failed command says why in a line; LOG_LEVEL=debug shows where too.
await program.parseAsync().catch((error: unknown) => {
  console.error(`bananacms: ${error instanceof Error ? error.message : String(error)}`)
  if (process.env.LOG_LEVEL === 'debug' && error instanceof Error) console.error(error.stack)
  process.exitCode = 1
})

function parseIndex(value: string): number {
  const index = Number(value)
  if (!Number.isInteger(index) || index < 1) {
    throw new InvalidArgumentError('Not a snapshot number: 1 is the newest.')
  }
  return index
}

function parsePort(value: string): number {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new InvalidArgumentError('Not a valid port.')
  }
  return port
}
