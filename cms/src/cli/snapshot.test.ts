import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { snapshotsConfig } from '../lib/snapshots/config.ts'
import { removePidFile, writePidFile } from '../lib/snapshots/pidfile.ts'
import { SnapshotStore } from '../lib/snapshots/store.ts'
import { migrate } from './migrate.ts'
import { openSiteDatabases } from './site-databases.ts'
import { backupNow, listSnapshotsCommand, restoreSnapshot, viewSnapshot } from './snapshot.ts'

let root: string
let info: ReturnType<typeof vi.spyOn>
beforeEach(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'bananacms-snapshots-'))
  vi.stubEnv('DATA_PATH', 'private')
  vi.stubEnv('SNAPSHOTS_COUNT', '5')
  info = vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  await migrate(root)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  rmSync(root, { recursive: true, force: true })
})

const sql = async (statements: string) => {
  using databases = await openSiteDatabases(root)
  await databases.main.client.executeMultiple(statements)
}
const categories = async () => {
  using databases = await openSiteDatabases(root)
  return (await databases.main.client.execute('SELECT id FROM category ORDER BY id')).rows.map(
    (row) => String(row.id),
  )
}
// a snapshot, as the site takes them
const snapshot = async () => {
  using databases = await openSiteDatabases(root)
  const config = snapshotsConfig(path.join(root, 'private'))!
  return await new SnapshotStore(config).createSnapshot(databases.main.client)
}
const printed = () => info.mock.calls.map((call: unknown[]) => String(call[0])).join('\n')

describe('snapshot', () => {
  beforeEach(async () => {
    await snapshot()
    await sql("INSERT INTO category (id, name, slug, shortid) VALUES ('c1', 'One', 'one', 's1')")
    await snapshot()
  })

  it('lists the snapshots, 1 being the newest', async () => {
    info.mockClear()
    await listSnapshotsCommand(root)
    expect(printed()).toMatch(/^#\s+kind\s+created\s+size\s+file\n1\s+diff\s.+\n2\s+full\s/)
  })

  it('prints a snapshot as SQL, and its stored diff with --raw', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    await viewSnapshot(root, 1)
    expect(String(write.mock.calls[0][0])).toContain(`INSERT INTO "category"`)
    write.mockClear()
    await viewSnapshot(root, 1, { raw: true })
    expect(String(write.mock.calls[0][0])).toMatch(/^-- bananacms-snapshot v1\n-- kind: diff\n/)
  })

  it('restores a snapshot, having snapshotted the database as it was first', async () => {
    await sql("INSERT INTO category (id, name, slug, shortid) VALUES ('c2', 'Two', 'two', 's2')")
    await restoreSnapshot(root, 2)
    expect(await categories()).toEqual([])
    // the database as it was before the restore is the newest snapshot now
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    await viewSnapshot(root, 1)
    expect(String(write.mock.calls[0][0])).toContain("'c2'")
  })

  it("won't restore while the site runs", async () => {
    writePidFile(root)
    try {
      await expect(restoreSnapshot(root, 1)).rejects.toThrow(
        `The site is running (pid ${process.pid})`,
      )
    } finally {
      removePidFile(root)
    }
  })

  it('says which snapshots there are for one there is not', async () => {
    await expect(restoreSnapshot(root, 9)).rejects.toThrow('No snapshot 9: there are 2')
  })
})

describe('backup now', () => {
  let agent: Server
  let received: { name: string; archive: Buffer }[]

  beforeEach(async () => {
    received = []
    // a backup agent, which takes an archive in a multipart POST
    agent = createServer(async (request, response) => {
      const form = await new Request('http://agent.test/', {
        method: 'POST',
        headers: request.headers as Record<string, string>,
        body: await new Response(request as unknown as ReadableStream).arrayBuffer(),
      }).formData()
      const file = form.get('backup') as File
      received.push({
        name: String(form.get('name')),
        archive: Buffer.from(await file.arrayBuffer()),
      })
      response.end('ok')
    })
    await new Promise<void>((resolve) => agent.listen(0, '127.0.0.1', resolve))
    const { port } = agent.address() as { port: number }
    vi.stubEnv('BACKUP_URL', `http://127.0.0.1:${port}/`)
  })
  afterEach(() => agent.close())

  it('sends the databases as a tar.gz, and nothing again while they are as they were', async () => {
    await backupNow(root)
    expect(received).toHaveLength(1)
    expect(received[0].name).toMatch(/^bananacms-\d{8}_\d{6}\.tgz$/)
    const tar = gunzipSync(received[0].archive)
    // the first entry's name, in its 512-byte header
    expect(tar.subarray(0, 11).toString()).toBe('database.db')
    // relaxed, the default mode, carries derived.db too
    expect(tar.includes(Buffer.from('derived.db\0'))).toBe(true)

    await backupNow(root)
    expect(received).toHaveLength(1)
    expect(printed()).toContain('The agent has this database already')
  })

  it('needs BACKUP_URL', async () => {
    vi.stubEnv('BACKUP_URL', '')
    await expect(backupNow(root)).rejects.toThrow('BACKUP_URL is not set')
  })
})
