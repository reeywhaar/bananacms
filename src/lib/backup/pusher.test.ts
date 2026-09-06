import { createServer, type Server } from 'node:http'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient, type Client } from '@libsql/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { BackupConfig, BackupMode } from './config'
import { BackupPusher } from './pusher'

const dirs: string[] = []
const clients: Client[] = []
const servers: Server[] = []

afterEach(async () => {
  for (const client of clients.splice(0)) client.close()
  for (const server of servers.splice(0)) await new Promise((r) => server.close(r))
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

interface Upload {
  name: string
  body: Buffer
}

/** A stand-in for the backup agent: keeps what it was given, or refuses. */
async function startAgent(): Promise<{
  url: string
  uploads: Upload[]
  reject: (s: number | null) => void
}> {
  const uploads: Upload[] = []
  let rejectWith: number | null = null
  const server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      if (rejectWith !== null) {
        res.writeHead(rejectWith)
        res.end('the remote said no')
        return
      }
      const raw = Buffer.concat(chunks)
      const header = raw.toString('latin1', 0, 2000)
      const match = /filename="([^"]+)"/.exec(header)
      uploads.push({ name: match?.[1] ?? '', body: raw })
      res.writeHead(204)
      res.end()
    })
  })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  return {
    url: `http://127.0.0.1:${port}/backup`,
    uploads,
    reject: (s: number | null) => {
      rejectWith = s
    },
  }
}

async function setup(mode: BackupMode = 'relaxed') {
  const dir = mkdtempSync(join(tmpdir(), 'bananacms-backup-'))
  dirs.push(dir)
  const dbPath = join(dir, 'database.db')
  const derivedDbPath = join(dir, 'derived.db')

  const main = createClient({ url: `file:${dbPath}` })
  clients.push(main)
  await main.executeMultiple(`
    CREATE TABLE post (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    INSERT INTO post (id, name) VALUES ('a', 'A');
  `)
  const derived = createClient({ url: `file:${derivedDbPath}` })
  clients.push(derived)
  await derived.executeMultiple(`
    CREATE TABLE backup_state (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      digest    TEXT NOT NULL,
      pushedAt  INTEGER NOT NULL
    );
  `)

  const agent = await startAgent()
  const config: BackupConfig = { url: agent.url, mode, dbPath, derivedDbPath }
  return { dir, config, agent, main }
}

const entriesOf = (dir: string, upload: Upload): string[] => {
  // Pull the tarball out of the multipart body: it starts after the blank line
  // that ends the part headers and ends before the closing boundary.
  const start = upload.body.indexOf(Buffer.from('\r\n\r\n')) + 4
  const end = upload.body.lastIndexOf(Buffer.from('\r\n------'))
  const path = join(dir, 'received.tgz')
  writeFileSync(path, upload.body.subarray(start, end))
  return execFileSync('tar', ['-tzf', path]).toString().trim().split('\n')
}

describe('BackupPusher', () => {
  it('sends the first copy, then stays quiet until something changes', async () => {
    const { config, agent, main } = await setup()
    const pusher = new BackupPusher({ config })

    expect(await pusher.runOnce()).toBe('pushed')
    expect(agent.uploads).toHaveLength(1)

    // Nothing written: the change counter has not moved, so nothing is copied.
    expect(await pusher.runOnce()).toBe('quiet')
    expect(agent.uploads).toHaveLength(1)

    await main.execute("INSERT INTO post (id, name) VALUES ('b', 'B')")
    expect(await pusher.runOnce()).toBe('pushed')
    expect(agent.uploads).toHaveLength(2)
    await pusher.stop()
  })

  it('does not send again when writes left the contents identical', async () => {
    const { config, agent, main } = await setup()
    const pusher = new BackupPusher({ config })
    expect(await pusher.runOnce()).toBe('pushed')

    // Real writes, so the change counter moves and the database is copied and
    // hashed — but they cancel out, and the digest is the one the agent holds.
    await main.execute("INSERT INTO post (id, name) VALUES ('tmp', 'T')")
    await main.execute("DELETE FROM post WHERE id = 'tmp'")
    expect(await pusher.runOnce()).toBe('unchanged')
    expect(agent.uploads).toHaveLength(1)
    await pusher.stop()
  })

  it('stays quiet through a write SQLite optimises away', async () => {
    const { config, agent, main } = await setup()
    const pusher = new BackupPusher({ config })
    expect(await pusher.runOnce()).toBe('pushed')

    // Setting a column to the value it already holds writes nothing at all, so
    // the counter does not move and the database is never even copied.
    await main.execute("UPDATE post SET name = 'A' WHERE id = 'a'")
    expect(await pusher.runOnce()).toBe('quiet')
    expect(agent.uploads).toHaveLength(1)
    await pusher.stop()
  })

  it('carries derived.db in relaxed but not in main', async () => {
    const relaxed = await setup('relaxed')
    const p1 = new BackupPusher({ config: relaxed.config })
    await p1.runOnce()
    expect(entriesOf(relaxed.dir, relaxed.agent.uploads[0])).toEqual(['database.db', 'derived.db'])
    await p1.stop()

    const mainOnly = await setup('main')
    const p2 = new BackupPusher({ config: mainOnly.config })
    await p2.runOnce()
    expect(entriesOf(mainOnly.dir, mainOnly.agent.uploads[0])).toEqual(['database.db'])
    await p2.stop()
  })

  it('does not record a backup the agent refused, and retries on the next pass', async () => {
    const { config, agent } = await setup()
    const pusher = new BackupPusher({ config })

    agent.reject(500)
    await expect(pusher.runOnce()).rejects.toThrow(/answered 500/)

    // The failure must not be remembered as success: with nothing written since,
    // a pusher that trusted its change counter would now sit quiet forever.
    agent.reject(null)
    expect(await pusher.runOnce()).toBe('pushed')
    expect(agent.uploads).toHaveLength(1)
    await pusher.stop()
  })

  it('sends on the floor in all mode even when nothing changed', async () => {
    const { config, agent } = await setup('all')
    let now = new Date('2026-01-01T00:00:00Z')
    const pusher = new BackupPusher({ config, now: () => now })

    expect(await pusher.runOnce()).toBe('pushed')
    now = new Date('2026-01-01T00:20:00Z')
    expect(await pusher.runOnce()).toBe('quiet')

    // Half an hour on, the heartbeat is due even though nothing was written.
    now = new Date('2026-01-01T00:31:00Z')
    expect(await pusher.runOnce()).toBe('pushed')
    expect(agent.uploads).toHaveLength(2)
    await pusher.stop()
  })

  it('force reads the database rather than trusting the counter', async () => {
    const { config, agent } = await setup()
    const pusher = new BackupPusher({ config })
    expect(await pusher.runOnce()).toBe('pushed')
    expect(await pusher.runOnce()).toBe('quiet')
    // Same unchanged database, but asked for explicitly.
    expect(await pusher.runOnce({ force: true })).toBe('unchanged')
    expect(agent.uploads).toHaveLength(1)
    await pusher.stop()
  })
})
