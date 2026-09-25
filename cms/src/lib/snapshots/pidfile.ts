import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// The site's .pid file, in its directory `root`, which `bananacms dev` and
// `start` keep while they run: `snapshot restore` won't replace a database the site
// has open.
export const pidFilePath = (root: string): string => join(root, '.pid')

export const writePidFile = (root: string): void => {
  writeFileSync(pidFilePath(root), `${process.pid}\n`)
}

// This process's .pid file, and not one another server of the site's has written
// since
export const removePidFile = (root: string): void => {
  let pid: number
  try {
    pid = Number.parseInt(readFileSync(pidFilePath(root), 'utf8').trim(), 10)
  } catch {
    return
  }
  if (pid === process.pid) rmSync(pidFilePath(root), { force: true })
}

// The running site's pid, or null when it isn't running. A .pid file left by a
// process that has gone is removed.
export const readRunningPid = (root: string): number | null => {
  let raw: string
  try {
    raw = readFileSync(pidFilePath(root), 'utf8')
  } catch {
    return null
  }
  const pid = Number.parseInt(raw.trim(), 10)
  if (!Number.isInteger(pid) || pid <= 0) return null
  try {
    process.kill(pid, 0)
    return pid
  } catch (error) {
    // EPERM: alive, but another user's
    if ((error as NodeJS.ErrnoException).code === 'EPERM') return pid
    rmSync(pidFilePath(root), { force: true })
    return null
  }
}
