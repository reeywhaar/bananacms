import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Pid file marking that the bananacms app is running. Lives at `.pid` in the
 * consumer directory (the cwd both `bananacms dev|start` and the CLI run
 * from), so `snapshot restore` can refuse to touch a database that is in use.
 */
export const pidFilePath = (): string => join(process.cwd(), '.pid')

export const writePidFile = (): void => {
  writeFileSync(pidFilePath(), `${process.pid}\n`)
}

export const removePidFile = (): void => {
  rmSync(pidFilePath(), { force: true })
}

/** Pid of the running app, or null if none (stale pid files are cleaned up). */
export const readRunningPid = (): number | null => {
  let raw: string
  try {
    raw = readFileSync(pidFilePath(), 'utf8')
  } catch {
    return null
  }
  const pid = Number.parseInt(raw.trim(), 10)
  if (!Number.isInteger(pid) || pid <= 0) return null
  try {
    process.kill(pid, 0)
    return pid
  } catch (error) {
    // EPERM = alive but owned by someone else; anything else = gone.
    if ((error as NodeJS.ErrnoException).code === 'EPERM') return pid
    rmSync(pidFilePath(), { force: true })
    return null
  }
}
