import { existsSync, readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Client } from '@libsql/client'
import sharp from 'sharp'
import { describeAudio, readAudioMeta } from '../lib/audioMeta.ts'
import { post } from '../lib/db/schema.ts'
import { cmsMigrations } from '../lib/migrations/index.ts'
import { PostSearchStore } from '../services/PostSearchStore.ts'
import { assetsDirectory, openSiteDatabases, siteMigrationsPath } from './site-databases.ts'

// The `db backfill` commands, which fill in what older databases lack. Each can run
// while the site does.

// Width and height for image assets that have none, from sharp
export async function backfillImageDimensions(
  root: string,
  options: { dryRun?: boolean } = {},
): Promise<{ updated: number; failed: number }> {
  using databases = await openSiteDatabases(root)
  const { client } = databases.main
  const ids = await selectIds(
    client,
    `SELECT id FROM asset
      WHERE mime LIKE 'image/%'
        AND (json_extract(content, '$.width') IS NULL OR json_extract(content, '$.height') IS NULL)`,
  )
  console.info(`Image assets with no dimensions: ${ids.length}`)
  // awaited, so the databases stay open until it's done
  return await eachAsset(client, root, ids, options, async (id, data) => {
    const meta = await sharp(data).metadata()
    const width = meta.autoOrient?.width ?? meta.width
    const height = meta.autoOrient?.height ?? meta.height
    if (!width || !height) return 'sharp found no dimensions'
    console.info(`  ${id}: ${width} × ${height}`)
    if (!options.dryRun) {
      await client.execute({
        sql: `UPDATE asset
                 SET content = json_set(COALESCE(content, '{}'), '$.width', ?, '$.height', ?)
               WHERE id = ?`,
        args: [width, height, id],
      })
    }
    return undefined
  })
}

// Duration, bitrate, sample rate, channels, codec and tags for audio assets that
// have no duration, from the files' headers
export async function backfillAudioMeta(
  root: string,
  options: { dryRun?: boolean } = {},
): Promise<{ updated: number; failed: number }> {
  using databases = await openSiteDatabases(root)
  const { client } = databases.main
  const ids = await selectIds(
    client,
    `SELECT id FROM asset
      WHERE mime LIKE 'audio/%' AND json_extract(content, '$.duration') IS NULL`,
  )
  console.info(`Audio assets with no metadata: ${ids.length}`)
  // awaited, so the databases stay open until it's done
  return await eachAsset(client, root, ids, options, async (id, data) => {
    const mime = (await client.execute({ sql: 'SELECT mime FROM asset WHERE id = ?', args: [id] }))
      .rows[0]?.mime
    const meta = await readAudioMeta(data, typeof mime === 'string' ? mime : undefined)
    if (!meta) return 'not readable as audio'
    console.info(`  ${id}: ${describeAudio(meta) || '(no technical metadata)'}`)
    if (!options.dryRun) {
      // merged into what's there, so a `type`, or anything an editor set, stays
      await client.execute({
        sql: `UPDATE asset SET content = json_patch(COALESCE(content, '{}'), ?) WHERE id = ?`,
        args: [JSON.stringify({ type: 'audio', ...meta }), id],
      })
    }
    return undefined
  })
}

// The post_fts search index, built again for every post
export async function backfillPostFts(root: string): Promise<{ indexed: number }> {
  using databases = await openSiteDatabases(root, { migrate: true })
  const { db } = databases.main
  const ids = (await db.select({ id: post.id }).from(post)).map((row) => row.id)
  console.info(`Indexing ${ids.length} post(s)...`)
  const store = new PostSearchStore(db)
  let indexed = 0
  for (const id of ids) {
    await store.rebuildPostIndex(id)
    indexed++
    if (indexed % 50 === 0) console.info(`  ${indexed}/${ids.length}`)
  }
  console.info(`bananacms: indexed ${indexed} post(s)`)
  return { indexed }
}

// Ids in the migrations table as the migration files have them now, matched by
// name, for a database from before migrations had timestamp ids: without them,
// the CMS would take those migrations for new ones and run them again.
export async function backfillMigrationIds(
  root: string,
  options: { dryRun?: boolean } = {},
): Promise<{ updated: number }> {
  const ids = new Map([
    ...cmsMigrations.map(({ id, name }): [string, number] => [name, id]),
    ...siteMigrationIds(siteMigrationsPath(root)),
  ])
  using databases = await openSiteDatabases(root)
  const { client } = databases.main
  let updated = 0
  for (const row of (await client.execute('SELECT id, name FROM migrations')).rows) {
    const [current, name] = [Number(row.id), String(row.name)]
    const expected = ids.get(name)
    if (expected === undefined) {
      console.warn(`  skip    ${current} ${name}: no migration file has that name`)
    } else if (expected === current) {
      console.info(`  ok      ${current} ${name}`)
    } else {
      console.info(
        `  update  ${current} → ${expected} ${name}${options.dryRun ? ' (dry run)' : ''}`,
      )
      if (!options.dryRun) {
        await client.execute({
          sql: 'UPDATE migrations SET id = ? WHERE name = ?',
          args: [expected, name],
        })
      }
      updated++
    }
  }
  console.info(
    `bananacms: ${options.dryRun ? 'would update' : 'updated'} ${updated} migration id(s)`,
  )
  return { updated }
}

// the ids of the site's <id>_<name>.ts migration files, by name
function siteMigrationIds(dir: string): [string, number][] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((file): [string, number][] => {
    const match = /^(\d+)_(.+)\.[jt]s$/.exec(file)
    return match && !file.endsWith('.d.ts') ? [[match[2], Number(match[1])]] : []
  })
}

async function selectIds(client: Client, sql: string): Promise<string[]> {
  return (await client.execute(sql)).rows.map((row) => String(row.id))
}

// Runs `update` with each asset's file, the cached one in ASSETS_DIRECTORY or else
// the one in the database, and counts what it updates. `update` returns why it
// couldn't, if it couldn't.
async function eachAsset(
  client: Client,
  root: string,
  ids: string[],
  options: { dryRun?: boolean },
  update: (id: string, data: Buffer) => Promise<string | undefined>,
): Promise<{ updated: number; failed: number }> {
  let updated = 0
  let failed = 0
  for (const id of ids) {
    try {
      const data = await assetData(client, root, id)
      const problem = data ? await update(id, data) : 'no file, and nothing in the database'
      if (problem) {
        console.warn(`  skip ${id}: ${problem}`)
        failed++
      } else {
        updated++
      }
    } catch (error) {
      console.warn(`  fail ${id}: ${error instanceof Error ? error.message : String(error)}`)
      failed++
    }
  }
  console.info(`${options.dryRun ? '[dry run] ' : ''}Updated ${updated}, failed ${failed}.`)
  return { updated, failed }
}

async function assetData(client: Client, root: string, id: string): Promise<Buffer | undefined> {
  const dir = assetsDirectory(root)
  const cached = dir && (await readFile(path.join(dir, id)).catch(() => undefined))
  if (cached) return cached
  // asset_blob holds the files, apart from the asset rows
  const data = (
    await client.execute({ sql: 'SELECT data FROM asset_blob WHERE id = ?', args: [id] })
  ).rows[0]?.data
  // libsql gives BLOBs as ArrayBuffers
  return data instanceof ArrayBuffer ? Buffer.from(data) : undefined
}
