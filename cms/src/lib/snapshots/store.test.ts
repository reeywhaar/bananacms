import { mkdtempSync, rmSync } from 'node:fs'
import { appendFile, mkdir, open, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient, type Client } from '@libsql/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { SnapshotsConfig } from './config.ts'
import { listSnapshots } from './files.ts'
import { SnapshotStore } from './store.ts'

const dirs: string[] = []
const clients: Client[] = []

afterEach(() => {
  for (const client of clients.splice(0)) client.close()
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

async function setup(count = 10) {
  const dir = mkdtempSync(join(tmpdir(), 'bananacms-store-'))
  dirs.push(dir)
  const dbPath = join(dir, 'database.db')
  const client = connect(dbPath)
  await client.executeMultiple(`
    CREATE TABLE migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
    CREATE TABLE item (id TEXT PRIMARY KEY, v TEXT NOT NULL);
    INSERT INTO migrations (id, name) VALUES (1, 'init');
  `)
  const config: SnapshotsConfig = {
    count,
    delayMs: 0,
    dir: join(dir, 'snapshots'),
    dbPath,
  }
  return { client, config, store: new SnapshotStore(config) }
}

function connect(path: string): Client {
  const client = createClient({ url: `file:${path}` })
  clients.push(client)
  return client
}

const setItem = (client: Client, id: string, v: string) =>
  client.execute({
    sql: 'INSERT INTO item (id, v) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET v = excluded.v',
    args: [id, v],
  })

// item a in snapshot n, 1 being the newest, read from its file
async function itemIn(config: SnapshotsConfig, n: number): Promise<string | null> {
  const snapshot = (await listSnapshots(config.dir))[n - 1]
  const client = connect(snapshot.path)
  const rows = await client.execute("SELECT v FROM item WHERE id = 'a'")
  return rows.rows[0] ? String(rows.rows[0].v) : null
}

describe('SnapshotStore.createSnapshot', () => {
  it('copies the database into a file of its own, and skips an unchanged one', async () => {
    const { client, config, store } = await setup()
    await setItem(client, 'a', 'v1')

    expect(await store.createSnapshot(client)).toBe('created')
    expect(await readdir(config.dir)).toEqual([
      expect.stringMatching(/^snapshot_\d{8}_\d{9}_[0-9a-f]{16}\.db$/),
    ])

    // a write that changes nothing is no change
    await setItem(client, 'a', 'v1')
    expect(await store.createSnapshot(client)).toBe('skipped-unchanged')

    await setItem(client, 'a', 'v2')
    expect(await store.createSnapshot(client)).toBe('created')
    expect(await listSnapshots(config.dir)).toHaveLength(2)
    expect(await itemIn(config, 1)).toBe('v2')
    expect(await itemIn(config, 2)).toBe('v1')
  })

  it('skips when the lock is held', async () => {
    const { client, config, store } = await setup()
    await mkdir(config.dir, { recursive: true })
    const lock = await open(join(config.dir, '.lock'), 'wx')
    try {
      expect(await store.createSnapshot(client)).toBe('skipped-locked')
    } finally {
      await lock.close()
    }
  })

  it('writes over a copy a snapshot cut short left behind', async () => {
    const { client, config, store } = await setup()
    await mkdir(config.dir, { recursive: true })
    await writeFile(join(config.dir, '.pending.db'), 'half a database')
    expect(await store.createSnapshot(client)).toBe('created')
    expect(await readdir(config.dir)).toEqual([expect.stringMatching(/\.db$/)])
  })

  it('removes the SQL snapshots of earlier versions once it has written a copy', async () => {
    const { client, config, store } = await setup()
    await mkdir(config.dir, { recursive: true })
    const old = [
      'snapshot_20260101_000000000.sql',
      'snapshot_20260102_000000000.diff',
      'snapshot_20260102_000000000_2.diff',
      'snapshot_20260103_000000000.sql.tmp',
    ]
    for (const file of old) await writeFile(join(config.dir, file), '-- bananacms-snapshot v1\n')
    await writeFile(join(config.dir, 'notes.txt'), 'mine')

    expect(await store.createSnapshot(client)).toBe('created')
    const files = await readdir(config.dir)
    for (const file of old) expect(files).not.toContain(file)
    expect(files).toContain('notes.txt')
    expect(await listSnapshots(config.dir)).toHaveLength(1)
  })
})

describe('SnapshotStore retention', () => {
  it('removes the oldest past the count', async () => {
    const { client, config, store } = await setup(2)
    for (const v of ['v1', 'v2', 'v3']) {
      await setItem(client, 'a', v)
      await store.createSnapshot(client)
    }
    expect(await listSnapshots(config.dir)).toHaveLength(2)
    expect(await itemIn(config, 1)).toBe('v3')
    expect(await itemIn(config, 2)).toBe('v2')
  })
})

describe('SnapshotStore.restore', () => {
  it('restores an older state, and snapshots the current one first', async () => {
    const { client, config, store } = await setup()
    await setItem(client, 'a', 'v1')
    await store.createSnapshot(client)
    await setItem(client, 'a', 'v2')
    client.close()

    await store.restore(1)

    const restored = connect(config.dbPath)
    const rows = await restored.execute("SELECT v FROM item WHERE id = 'a'")
    expect(rows.rows[0].v).toBe('v1')
    // the state before the restore is the newest snapshot
    expect(await itemIn(config, 1)).toBe('v2')
  })

  it('restores the oldest snapshot, which snapshotting the current state removes', async () => {
    const { client, config, store } = await setup(2)
    await setItem(client, 'a', 'v1')
    await store.createSnapshot(client)
    await setItem(client, 'a', 'v2')
    await store.createSnapshot(client)
    await setItem(client, 'a', 'v3')
    client.close()

    await store.restore(2)

    const restored = connect(config.dbPath)
    const rows = await restored.execute("SELECT v FROM item WHERE id = 'a'")
    expect(rows.rows[0].v).toBe('v1')
    expect(await itemIn(config, 1)).toBe('v3')
    expect(await itemIn(config, 2)).toBe('v2')
  })

  it("refuses a snapshot that isn't the file its name says, leaving the database be", async () => {
    const { client, config, store } = await setup()
    await setItem(client, 'a', 'v1')
    await store.createSnapshot(client)
    await setItem(client, 'a', 'v2')
    client.close()
    await appendFile((await listSnapshots(config.dir))[0].path, 'more')

    await expect(store.restore(1)).rejects.toThrow(/isn't the file its name says/)
    const current = connect(config.dbPath)
    const rows = await current.execute("SELECT v FROM item WHERE id = 'a'")
    expect(rows.rows[0].v).toBe('v2')
    expect(await readdir(join(config.dbPath, '..'))).not.toContain('database.db.restore-tmp')
  })

  it('rejects an out-of-range index without touching anything', async () => {
    const { client, store } = await setup()
    await store.createSnapshot(client)
    await expect(store.restore(5)).rejects.toThrow(/No snapshot at index/)
  })
})
