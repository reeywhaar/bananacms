import { mkdtempSync, rmSync } from 'node:fs'
import { mkdir, open, readdir, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient, type Client } from '@libsql/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { SnapshotsConfig } from './config'
import { SnapshotStore } from './store'

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
  const client = createClient({ url: `file:${dbPath}` })
  clients.push(client)
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

const setItem = (client: Client, id: string, v: string) =>
  client.execute({
    sql: 'INSERT INTO item (id, v) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET v = excluded.v',
    args: [id, v],
  })

const snapshotFiles = async (config: SnapshotsConfig) => (await readdir(config.dir)).sort()

describe('SnapshotStore.createSnapshot', () => {
  it('writes a full snapshot first, diffs after, and dedupes unchanged states', async () => {
    const { client, config, store } = await setup()

    expect(await store.createSnapshot(client)).toBe('created')
    expect(await snapshotFiles(config)).toEqual([expect.stringMatching(/\.sql$/)])

    expect(await store.createSnapshot(client)).toBe('skipped-unchanged')

    await setItem(client, 'a', 'v2')
    expect(await store.createSnapshot(client)).toBe('created')

    const files = await snapshotFiles(config)
    expect(files).toHaveLength(2)
    expect(files.filter((f) => f.endsWith('.sql'))).toHaveLength(1)
    expect(files.filter((f) => f.endsWith('.diff'))).toHaveLength(1)

    expect(await store.reconstruct(1)).toContain("'v2'")
    expect(await store.reconstruct(2)).not.toContain("'v2'")
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

  it('self-heals a broken chain by writing a full snapshot', async () => {
    const { client, config, store } = await setup()
    await store.createSnapshot(client)
    await setItem(client, 'a', 'v2')
    await store.createSnapshot(client)

    const fullFile = (await snapshotFiles(config)).find((f) => f.endsWith('.sql'))
    await unlink(join(config.dir, fullFile as string))

    await setItem(client, 'a', 'v3')
    expect(await store.createSnapshot(client)).toBe('created')

    const files = await snapshotFiles(config)
    expect(files.filter((f) => f.endsWith('.sql'))).toHaveLength(1)
    expect(await store.reconstruct(1)).toContain("'v3'")
    await expect(store.reconstruct(2)).rejects.toThrow(/chain is broken/)
  })
})

describe('SnapshotStore retention', () => {
  it('folds the oldest snapshot into its successor when over the limit', async () => {
    const { client, config, store } = await setup(2)

    await setItem(client, 'a', 'v1')
    await store.createSnapshot(client)
    await setItem(client, 'a', 'v2')
    await store.createSnapshot(client)
    await setItem(client, 'a', 'v3')
    await store.createSnapshot(client)

    const files = await snapshotFiles(config)
    expect(files).toHaveLength(2)
    expect(files.filter((f) => f.endsWith('.sql'))).toHaveLength(1)

    expect(await store.reconstruct(1)).toContain("'v3'")
    expect(await store.reconstruct(2)).toContain("'v2'")
    await expect(store.reconstruct(3)).rejects.toThrow(/No snapshot at index/)
  })
})

describe('SnapshotStore.restore', () => {
  it('restores an older state and safety-snapshots the current one first', async () => {
    const { client, config, store } = await setup()

    await setItem(client, 'a', 'v1')
    await store.createSnapshot(client)
    await setItem(client, 'a', 'v2')
    client.close()

    await store.restore(1)

    const restored = createClient({ url: `file:${config.dbPath}` })
    clients.push(restored)
    const rows = await restored.execute("SELECT v FROM item WHERE id = 'a'")
    expect(rows.rows[0].v).toBe('v1')

    // The pre-restore state (v2) was captured as the newest snapshot.
    expect(await store.reconstruct(1)).toContain("'v2'")
  })

  it('rejects an out-of-range index without touching anything', async () => {
    const { client, store } = await setup()
    await store.createSnapshot(client)
    await expect(store.restore(5)).rejects.toThrow(/No snapshot at index/)
  })
})
