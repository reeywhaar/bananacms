import { existsSync } from 'node:fs'
import { createClient, type Client } from '@libsql/client'
import type { Logger } from '../logger/Logger.ts'
import { BACKUP_DELAY_MS, backupPeriodMs, carriesDerived, type BackupConfig } from './config.ts'
import { archiveFilename, packArchive, stageBackup } from './archive.ts'
import { pushArchive } from './push.ts'
import { ensureBackupState, readBackupState, recordBackup } from './state.ts'

export type PassResult =
  /** An archive was built and the agent accepted it. */
  | 'pushed'
  /** The database was copied and hashed; it is what the agent already has. */
  | 'unchanged'
  /** Nothing has written to the database since the last pass; nothing was copied. */
  | 'quiet'
  /**
   * There is no database yet. The zones create it at boot, and this loop starts
   * alongside them, so the first pass on a fresh data directory routinely
   * arrives first.
   */
  | 'not-ready'

const NOT_READY_RETRY_MS = 5_000

export interface BackupPusherOptions {
  config: BackupConfig
  logger?: Logger
  /**
   * How often to look, defaulting to [BACKUP_DELAY_MS].
   *
   * An option only so a test can drive the loop without waiting five minutes.
   * Nothing reads it from the environment: see the constants in config for why
   * this is not a setting.
   */
  everyMs?: number
  now?: () => Date
}

/**
 * Copies the databases to a backup agent, on the terms the mode sets.
 *
 * The interval is also the throttle, and that is most of what it is for.
 * Nothing here reacts to a write, so an editor saving six times in a minute
 * gets one archive holding all six rather than six archives, and there is no
 * burst this can be made to keep up with.
 */
export class BackupPusher {
  private readonly config: BackupConfig
  private readonly logger?: Logger
  private readonly everyMs: number
  private readonly notReadyMs: number
  private readonly now: () => Date

  private watcher: Client | null = null
  private derived: Client | null = null
  /**
   * `PRAGMA data_version` as of the last pass that ended cleanly, or null to
   * force a full check. Left null after a failure on purpose: a pass that threw
   * has no idea whether the agent holds the current database, and trusting an
   * unchanged counter there would wait for the next write to try again.
   */
  private seenDataVersion: number | null = null
  /** Whether backup_state has been checked for this pusher's lifetime. */
  private stateReady = false
  private timer: NodeJS.Timeout | null = null
  private stopped = false

  constructor(opts: BackupPusherOptions) {
    this.config = opts.config
    this.logger = opts.logger
    this.everyMs = opts.everyMs ?? BACKUP_DELAY_MS
    // While the zones are still creating the database, look again shortly
    // rather than waiting out a full interval: a fresh instance is the one most
    // worth having a copy of, and booting takes seconds.
    this.notReadyMs = Math.min(NOT_READY_RETRY_MS, this.everyMs)
    this.now = opts.now ?? (() => new Date())
  }

  /**
   * Begins the loop. The first pass is immediate rather than one interval in: a
   * process that has just started is the one most likely to be running on a
   * volume nobody has a copy of, or a version whose migrations have just
   * rewritten the database.
   */
  start(): void {
    this.logger?.info('backing up', {
      to: this.config.url,
      mode: this.config.mode,
      everyMs: this.everyMs,
      carriesDerived: carriesDerived(this.config.mode),
    })
    void this.tick()
  }

  /** Stops the loop and closes the connections it holds. */
  async stop(): Promise<void> {
    this.stopped = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.watcher?.close()
    this.derived?.close()
    this.watcher = null
    this.derived = null
    await Promise.resolve()
  }

  private async tick(): Promise<void> {
    if (this.stopped) return
    let wait = this.everyMs
    try {
      if ((await this.runOnce()) === 'not-ready') wait = this.notReadyMs
    } catch (error) {
      // Logged and left for the next pass rather than retried here. What fails
      // is either transient — the agent restarting, the remote unreachable — or
      // needs a person, and neither is helped by trying again a second later.
      this.logger?.error('backup failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
    if (this.stopped) return
    this.timer = setTimeout(() => void this.tick(), wait)
    // Never let the loop hold the process open past a shutdown.
    this.timer.unref()
  }

  /**
   * Builds a copy, sends it if it is due, and remembers what was sent.
   *
   * `force` skips the cheap did-anything-change probe, for a person who has
   * asked for a backup right now and wants the database read rather than a
   * counter consulted.
   */
  async runOnce({ force = false }: { force?: boolean } = {}): Promise<PassResult> {
    // VACUUM INTO on a path that is not a database would happily create an
    // empty one, so an absent file is "wait", never "back up nothing".
    if (!existsSync(this.config.dbPath)) {
      this.logger?.debug('no database to back up yet')
      return 'not-ready'
    }
    const derived = this.derivedClient()
    if (!this.stateReady) {
      await ensureBackupState(derived)
      this.stateReady = true
    }
    const state = await readBackupState(derived)
    const now = this.now()

    // The floor, which only `all` has. It is a heartbeat rather than a guard on
    // anything: an agent told how often to expect an archive can say a
    // bananacms has stopped backing up, and with copies arriving only when
    // somebody edits something it cannot tell a broken instance from a quiet one.
    const period = backupPeriodMs(this.config.mode)
    const due = period > 0 && state !== null && now.getTime() - state.pushedAt.getTime() >= period

    // The cheap question first. btw vacuums its main database every pass just
    // to hash it, which it can afford; a bananacms database holds its asset
    // blobs, so that is the site's whole media library rebuilt every five
    // minutes to find out whether anybody touched a post. `PRAGMA data_version`
    // answers "has another connection committed since I last looked" for the
    // price of a read, and only when it moves is a copy worth making.
    const dataVersion = await this.readDataVersion()
    if (!force && !due && state !== null && dataVersion !== null) {
      if (this.seenDataVersion === dataVersion) {
        this.logger?.debug('nothing to back up; the database is as it was', {
          since: state.pushedAt.toISOString(),
        })
        return 'quiet'
      }
    }

    const staged = await stageBackup(this.config.dbPath)
    try {
      const changed = state === null || state.digest !== staged.digest
      if (!changed && !due) {
        // The counter moved but the contents did not — a write that changed
        // nothing, or a checkpoint. Remember the counter so the next pass is
        // free again.
        this.seenDataVersion = dataVersion
        this.logger?.debug('nothing to back up; the database is as it was', {
          since: state?.pushedAt.toISOString(),
        })
        return 'unchanged'
      }

      const derivedPath = carriesDerived(this.config.mode) ? this.config.derivedDbPath : null
      const archive = await packArchive(staged, derivedPath, now)
      const name = archiveFilename(now)
      await pushArchive(this.config.url, name, archive.path)

      // Only now — see recordBackup.
      await recordBackup(derived, staged.digest, now)
      this.seenDataVersion = dataVersion
      this.logger?.info('backed up', {
        name,
        bytes: archive.bytes,
        mode: this.config.mode,
        changed,
        first: state === null,
      })
      return 'pushed'
    } finally {
      await staged.cleanup()
    }
  }

  /** null when the counter cannot be read; the caller then does the full check. */
  private async readDataVersion(): Promise<number | null> {
    try {
      const client = this.watcherClient()
      const { rows } = await client.execute('PRAGMA data_version')
      const value = Number(rows[0]?.data_version)
      return Number.isFinite(value) ? value : null
    } catch {
      return null
    }
  }

  /**
   * Long-lived on purpose: `data_version` reports writes made by *other*
   * connections since this one last looked, so a fresh connection every pass
   * would answer a different question and never see a change.
   */
  private watcherClient(): Client {
    this.watcher ??= createClient({ url: `file:${this.config.dbPath}` })
    return this.watcher
  }

  private derivedClient(): Client {
    this.derived ??= createClient({ url: `file:${this.config.derivedDbPath}` })
    return this.derived
  }
}
