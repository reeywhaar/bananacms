import { join } from 'node:path'
import { openDb } from '@cms/lib/db/client'

export async function run({ dryRun }: { dryRun: boolean }): Promise<void> {
  const dataPath = requireEnv('DATA_PATH')
  const dbPath = join(dataPath, 'database.db')

  const { client } = await openDb(dbPath)

  await client.execute('BEGIN')

  try {
    const orphanPosts = (
      await client.execute(`
        SELECT p.id FROM post p
          WHERE NOT EXISTS (
            SELECT 1 FROM parent_post pp
              JOIN category c ON c.id = pp.parentId
             WHERE pp.postId = p.id AND pp.parentTable = 'category'
          )
      `)
    ).rows.map((r) => String(r.id))
    console.info(`Orphan posts (no category): ${orphanPosts.length}`)
    for (const id of orphanPosts) console.info(`  post ${id}`)
    if (orphanPosts.length > 0) {
      const placeholders = orphanPosts.map(() => '?').join(',')
      await client.execute({
        sql: `DELETE FROM post WHERE id IN (${placeholders})`,
        args: orphanPosts,
      })
    }

    let totalOrphanBlocks = 0
    for (;;) {
      const orphanBlocks = (
        await client.execute(`
          SELECT b.id FROM block b
             LEFT JOIN parent_block pb ON pb.blockId = b.id
            WHERE pb.blockId IS NULL
               OR (pb.parentTable = 'post'     AND NOT EXISTS (SELECT 1 FROM post     WHERE id = pb.parentId))
               OR (pb.parentTable = 'block'    AND NOT EXISTS (SELECT 1 FROM block    WHERE id = pb.parentId))
               OR (pb.parentTable = 'page'     AND NOT EXISTS (SELECT 1 FROM page     WHERE id = pb.parentId))
               OR (pb.parentTable = 'category' AND NOT EXISTS (SELECT 1 FROM category WHERE id = pb.parentId))
               OR (pb.parentTable = 'tag'      AND NOT EXISTS (SELECT 1 FROM tag      WHERE id = pb.parentId))
               OR pb.parentTable NOT IN ('post', 'block', 'page', 'category', 'tag')
        `)
      ).rows.map((r) => String(r.id))
      if (orphanBlocks.length === 0) break
      for (const id of orphanBlocks) console.info(`  block ${id}`)
      const placeholders = orphanBlocks.map(() => '?').join(',')
      await client.execute({
        sql: `DELETE FROM block WHERE id IN (${placeholders})`,
        args: orphanBlocks,
      })
      totalOrphanBlocks += orphanBlocks.length
    }
    console.info(`Orphan blocks (no parent): ${totalOrphanBlocks}`)

    const orphanAttributes = (
      await client.execute(`
        SELECT a.id FROM attribute a
           LEFT JOIN parent_attribute pa ON pa.attributeId = a.id
          WHERE pa.attributeId IS NULL
             OR (pa.parentTable = 'post'     AND NOT EXISTS (SELECT 1 FROM post     WHERE id = pa.parentId))
             OR (pa.parentTable = 'category' AND NOT EXISTS (SELECT 1 FROM category WHERE id = pa.parentId))
             OR (pa.parentTable = 'page'     AND NOT EXISTS (SELECT 1 FROM page     WHERE id = pa.parentId))
             OR (pa.parentTable = 'block'    AND NOT EXISTS (SELECT 1 FROM block    WHERE id = pa.parentId))
             OR (pa.parentTable = 'tag'      AND NOT EXISTS (SELECT 1 FROM tag      WHERE id = pa.parentId))
             OR pa.parentTable NOT IN ('post', 'category', 'page', 'block', 'tag')
      `)
    ).rows.map((r) => String(r.id))
    console.info(`Orphan attributes (no parent): ${orphanAttributes.length}`)
    for (const id of orphanAttributes) console.info(`  attribute ${id}`)
    if (orphanAttributes.length > 0) {
      const placeholders = orphanAttributes.map(() => '?').join(',')
      await client.execute({
        sql: `DELETE FROM attribute WHERE id IN (${placeholders})`,
        args: orphanAttributes,
      })
    }

    const orphanAssets = (
      await client.execute(`
        SELECT a.id FROM asset a
          WHERE NOT EXISTS (
            SELECT 1 FROM parent_asset pa
              JOIN block b ON b.id = pa.parentId
             WHERE pa.assetId = a.id AND pa.parentTable = 'block'
          )
      `)
    ).rows.map((r) => String(r.id))
    console.info(`Orphan assets (no parent block): ${orphanAssets.length}`)
    for (const id of orphanAssets) console.info(`  asset ${id}`)
    if (orphanAssets.length > 0) {
      const placeholders = orphanAssets.map(() => '?').join(',')
      await client.execute({
        sql: `DELETE FROM asset WHERE id IN (${placeholders})`,
        args: orphanAssets,
      })
    }

    if (dryRun) {
      await client.execute('ROLLBACK')
      console.info('[dry-run] Rolled back; no changes written.')
    } else {
      await client.execute('COMMIT')
      await client.execute('VACUUM')
      // VACUUM in WAL mode streams the rebuilt database through the -wal
      // file; truncate it to actually return the space.
      await client.execute('PRAGMA wal_checkpoint(TRUNCATE)')
      console.info('Cleanup complete.')
    }
  } catch (e) {
    await client.execute('ROLLBACK')
    throw e
  } finally {
    client.close()
  }
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`${name} is not set. Provide it via .env or the environment.`)
    process.exit(1)
  }
  return v
}
