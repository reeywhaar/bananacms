import { open } from 'sqlite'
import sqlite3 from 'sqlite3'

export async function run({ dryRun }: { dryRun: boolean }): Promise<void> {
  const dbPath = requireEnv('DB_PATH')

  const db = await open({ filename: dbPath, driver: sqlite3.Database })
  await db.run('PRAGMA foreign_keys = ON')

  await db.run('BEGIN')

  try {
    const orphanPosts = await db.all<{ id: string }[]>(
      `SELECT p.id FROM post p
        WHERE NOT EXISTS (
          SELECT 1 FROM parent_post pp
            JOIN category c ON c.id = pp.parentId
           WHERE pp.postId = p.id AND pp.parentTable = 'category'
        )`,
    )
    console.info(`Orphan posts (no category): ${orphanPosts.length}`)
    for (const row of orphanPosts) console.info(`  post ${row.id}`)
    if (orphanPosts.length > 0) {
      await db.run(
        `DELETE FROM post WHERE id IN (${orphanPosts.map(() => '?').join(',')})`,
        ...orphanPosts.map((r) => r.id),
      )
    }

    // Iterate: deleting a parent block orphans its children. The block-delete
    // cascade trigger handles most cases, but a block whose parent_block points
    // at a never-existed id is only found after its ancestors are gone.
    let totalOrphanBlocks = 0
    for (;;) {
      const orphanBlocks = await db.all<{ id: string }[]>(
        `SELECT b.id FROM block b
           LEFT JOIN parent_block pb ON pb.blockId = b.id
          WHERE pb.blockId IS NULL
             OR (pb.parentTable = 'post'  AND NOT EXISTS (SELECT 1 FROM post  WHERE id = pb.parentId))
             OR (pb.parentTable = 'block' AND NOT EXISTS (SELECT 1 FROM block WHERE id = pb.parentId))
             OR (pb.parentTable = 'page'  AND NOT EXISTS (SELECT 1 FROM page  WHERE id = pb.parentId))
             OR pb.parentTable NOT IN ('post', 'block', 'page')`,
      )
      if (orphanBlocks.length === 0) break
      for (const row of orphanBlocks) console.info(`  block ${row.id}`)
      await db.run(
        `DELETE FROM block WHERE id IN (${orphanBlocks.map(() => '?').join(',')})`,
        ...orphanBlocks.map((r) => r.id),
      )
      totalOrphanBlocks += orphanBlocks.length
    }
    console.info(`Orphan blocks (no parent): ${totalOrphanBlocks}`)

    const orphanAttributes = await db.all<{ id: string }[]>(
      `SELECT a.id FROM attribute a
         LEFT JOIN parent_attribute pa ON pa.attributeId = a.id
        WHERE pa.attributeId IS NULL
           OR (pa.parentTable = 'post'     AND NOT EXISTS (SELECT 1 FROM post     WHERE id = pa.parentId))
           OR (pa.parentTable = 'category' AND NOT EXISTS (SELECT 1 FROM category WHERE id = pa.parentId))
           OR (pa.parentTable = 'page'     AND NOT EXISTS (SELECT 1 FROM page     WHERE id = pa.parentId))
           OR (pa.parentTable = 'block'    AND NOT EXISTS (SELECT 1 FROM block    WHERE id = pa.parentId))
           OR pa.parentTable NOT IN ('post', 'category', 'page', 'block')`,
    )
    console.info(`Orphan attributes (no parent): ${orphanAttributes.length}`)
    for (const row of orphanAttributes) console.info(`  attribute ${row.id}`)
    if (orphanAttributes.length > 0) {
      await db.run(
        `DELETE FROM attribute WHERE id IN (${orphanAttributes.map(() => '?').join(',')})`,
        ...orphanAttributes.map((r) => r.id),
      )
    }

    const orphanAssets = await db.all<{ id: string }[]>(
      `SELECT a.id FROM asset a
        WHERE NOT EXISTS (
          SELECT 1 FROM parent_asset pa
            JOIN block b ON b.id = pa.parentId
           WHERE pa.assetId = a.id AND pa.parentTable = 'block'
        )`,
    )
    console.info(`Orphan assets (no parent block): ${orphanAssets.length}`)
    for (const row of orphanAssets) console.info(`  asset ${row.id}`)
    if (orphanAssets.length > 0) {
      await db.run(
        `DELETE FROM asset WHERE id IN (${orphanAssets.map(() => '?').join(',')})`,
        ...orphanAssets.map((r) => r.id),
      )
    }

    if (dryRun) {
      await db.run('ROLLBACK')
      console.info('[dry-run] Rolled back; no changes written.')
    } else {
      await db.run('COMMIT')
      await db.run('VACUUM')
      console.info('Cleanup complete.')
    }
  } catch (e) {
    await db.run('ROLLBACK')
    throw e
  } finally {
    await db.close()
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
