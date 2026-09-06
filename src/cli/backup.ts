import { getBackupConfig, BACKUP_MODES } from '../lib/backup/config.ts'
import { BackupPusher } from '../lib/backup/pusher.ts'
import { createRootLogger } from '../lib/logger/root.ts'

export async function run(): Promise<void> {
  const config = getBackupConfig()
  if (!config) {
    console.error(
      'BACKUP_URL is not set, so backups are off. Point it at a backup agent that takes an archive at POST /.',
    )
    process.exit(1)
  }

  console.info(`Backing up to ${config.url} (mode: ${config.mode})`)
  const pusher = new BackupPusher({ config, logger: createRootLogger().child('backup') })
  try {
    // force: somebody asking for a backup now wants the database read, not the
    // change counter consulted.
    const result = await pusher.runOnce({ force: true })
    if (result === 'unchanged') {
      console.info('The agent already has this database; nothing sent.')
    }
  } finally {
    await pusher.stop()
  }
}

export const backupModeList = BACKUP_MODES.join(', ')
