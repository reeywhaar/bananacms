import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { createClient } from '@libsql/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { siteCli } from './cli.ts'

// End-to-end tests of how `bananacms dev` and `start` stop on SIGTERM, on the
// site in cms/test/site: with a last snapshot and a last backup, the databases'
// -wal files folded into them, and the .pid file gone.

const siteDir = fileURLToPath(new URL('site', import.meta.url))
const { runCli, startServer } = siteCli(siteDir)

// a backup agent, which keeps the archives it's sent
const archives: Buffer[] = []
let agent: Server
let agentUrl: string

beforeAll(async () => {
  agent = createServer(async (request, response) => {
    const form = await new Request('http://agent.test/', {
      method: 'POST',
      headers: request.headers as Record<string, string>,
      body: await new Response(request as unknown as ReadableStream).arrayBuffer(),
    }).formData()
    archives.push(Buffer.from(await (form.get('backup') as File).arrayBuffer()))
    response.end('ok')
  })
  await new Promise<void>((resolve) => agent.listen(0, '127.0.0.1', resolve))
  agentUrl = `http://127.0.0.1:${(agent.address() as { port: number }).port}/`
})

afterAll(() => agent.close())

describe.each(['dev', 'start'] as const)('bananacms %s, on SIGTERM', (command) => {
  const dataPath = mkdtempSync(join(tmpdir(), `bananacms-shutdown-${command}-`))
  const snapshots = { SNAPSHOTS_COUNT: '5' }
  let exitCode: number | null
  let output: string
  // what's in DATA_PATH once it has exited
  let files: string[]
  const addCategory = async (id: string) => {
    const client = createClient({ url: `file:${join(dataPath, 'database.db')}` })
    try {
      await client.execute({
        sql: 'INSERT INTO category (id, name, slug, shortid) VALUES (?, ?, ?, ?)',
        args: [id, id, id, id],
      })
    } finally {
      client.close()
    }
  }

  beforeAll(async () => {
    if (command === 'start') await runCli(['build'], dataPath)
    await runCli(['db', 'migration', 'run'], dataPath)
    await addCategory('before')
    archives.length = 0
    const server = await startServer(command, dataPath, { ...snapshots, BACKUP_URL: agentUrl })
    // the app opens the databases
    expect((await fetch(server.url)).status).toBe(200)
    // a write from outside the site, which only the last snapshot and backup can
    // have
    await addCategory('while-running')
    server.stop()
    exitCode = await server.exited
    output = server.output()
    files = readdirSync(dataPath)
  })

  afterAll(() => {
    rmSync(dataPath, { recursive: true, force: true })
    if (command === 'start') rmSync(join(siteDir, 'dist'), { recursive: true, force: true })
  })

  it('exits with 0 once it has shut down', () => {
    expect(output).toContain('SIGTERM, shutting down')
    expect(exitCode).toBe(0)
  })

  it('takes a snapshot as it starts, and another as it stops', async () => {
    const dir = join(dataPath, 'snapshots')
    // the categories in a snapshot, which is a copy of the database
    const categories = async (file: string) => {
      const client = createClient({ url: `file:${join(dir, file)}` })
      try {
        return (await client.execute('SELECT id FROM category')).rows.map((row) => String(row.id))
      } finally {
        client.close()
      }
    }
    // the names sort in the order they were taken
    const [first, last] = readdirSync(dir)
      .filter((file) => file.startsWith('snapshot_'))
      .sort()
    expect(await categories(first)).toEqual(['before'])
    expect(await categories(last)).toContain('while-running')
  })

  it('sends a last backup, which has the last write', () => {
    expect(archives.length).toBeGreaterThan(0)
    expect(gunzipSync(archives.at(-1)!).includes('while-running')).toBe(true)
  })

  it('leaves each database in its .db file alone, with no -wal or -shm file', () => {
    expect(files).toContain('database.db')
    expect(files.filter((name) => /-(wal|shm)$/.test(name))).toEqual([])
  })

  it('removes the .pid file', () => {
    expect(existsSync(join(siteDir, '.pid'))).toBe(false)
  })
})
