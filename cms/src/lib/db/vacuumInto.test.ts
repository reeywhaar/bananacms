import { mkdtempSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@libsql/client'
import { afterEach, describe, expect, it } from 'vitest'
import { vacuumInto } from './vacuumInto.ts'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

async function database(blobs: number) {
  const dir = mkdtempSync(join(tmpdir(), 'bananacms-vacuum-'))
  dirs.push(dir)
  const path = join(dir, 'database.db')
  using stack = new DisposableStack()
  const client = stack.adopt(createClient({ url: `file:${path}` }), (client) => client.close())
  await client.executeMultiple(`
    PRAGMA journal_mode=WAL;
    CREATE TABLE item (b BLOB);
    INSERT INTO item SELECT randomblob(100000) FROM (
      WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < ${blobs})
      SELECT x FROM n
    );
  `)
  return { dir, path }
}

const count = async (path: string) => {
  using stack = new DisposableStack()
  const client = stack.adopt(createClient({ url: `file:${path}` }), (client) => client.close())
  return Number((await client.execute('SELECT count(*) FROM item')).rows[0][0])
}

describe('vacuumInto', () => {
  it('copies the database, to a path with a quote in it as well', async () => {
    const { dir, path } = await database(3)
    await mkdir(join(dir, "it's"))
    const target = join(dir, "it's", 'copy.db')
    await vacuumInto(path, target)
    expect(await count(target)).toBe(3)
  })

  it('leaves the event loop running while it copies', async () => {
    // 100MB
    const { dir, path } = await database(1000)
    let last = performance.now()
    let longestStall = 0
    using stack = new DisposableStack()
    const timer = setInterval(() => {
      const now = performance.now()
      longestStall = Math.max(longestStall, now - last)
      last = now
    }, 5)
    stack.defer(() => clearInterval(timer))
    const startedAt = performance.now()
    await vacuumInto(path, join(dir, 'copy.db'))
    const took = performance.now() - startedAt
    longestStall = Math.max(longestStall, performance.now() - last)
    expect(longestStall).toBeLessThan(took / 2)
  })
})
