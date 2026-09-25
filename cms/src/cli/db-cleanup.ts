import { constants } from 'node:os'
import type { Transaction } from '@libsql/client'
import { openSiteDatabases } from './site-databases.ts'

// Deletes what nothing points to any more, in one transaction: posts in no category,
// blocks with no parent, which can take several rounds as blocks nest, attributes
// with no parent, and assets in no block. Then it vacuums the database. With
// `dryRun`, it lists them and rolls back.
//
// A SIGINT or SIGTERM stops it at the next safe point with nothing written, since
// a running statement can't be cancelled. A second one exits right away.
export async function cleanupDatabase(
  root: string,
  options: { dryRun?: boolean } = {},
): Promise<void> {
  using databases = await openSiteDatabases(root)
  const { client } = databases.main

  let signal: NodeJS.Signals | undefined
  const onSignal = (received: NodeJS.Signals) => {
    if (signal) {
      console.error(`\nbananacms: ${received} again, exiting without rolling back`)
      process.exit(exitCodeFor(received))
    }
    signal = received
    console.error(`\nbananacms: ${received}, stopping at the next safe point...`)
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)
  const checkSignal = () => {
    if (signal) throw new Stopped(signal)
  }

  try {
    // a transaction of libsql's keeps its connection: the client lends each of its
    // own statements a connection from a pool, and rolls back one returned in a
    // transaction
    const tx = await client.transaction('write')
    try {
      await deleteAll(tx, 'post', 'Posts in no category', ORPHAN_POSTS)

      let blocks = 0
      for (;;) {
        checkSignal()
        const deleted = await deleteAll(tx, 'block', undefined, ORPHAN_BLOCKS)
        if (deleted === 0) break
        blocks += deleted
      }
      console.info(`Blocks with no parent: ${blocks}`)

      checkSignal()
      await deleteAll(tx, 'attribute', 'Attributes with no parent', ORPHAN_ATTRIBUTES)
      checkSignal()
      await deleteAll(tx, 'asset', 'Assets in no block', ORPHAN_ASSETS)
      checkSignal()

      if (options.dryRun) {
        await tx.rollback()
        console.info('[dry run] Rolled back, nothing written.')
        return
      }
      await tx.commit()
    } finally {
      // rolls back a transaction still open, and gives its connection back
      tx.close()
    }

    // what's left only frees space, and VACUUM can't be stopped
    if (signal) {
      console.error("bananacms: the changes are in; finishing VACUUM, which can't be stopped")
    }
    await client.execute('VACUUM')
    // in WAL mode, VACUUM writes the rebuilt database through the -wal file
    await client.execute('PRAGMA wal_checkpoint(TRUNCATE)')
    console.info('bananacms: cleanup done')
  } catch (error) {
    if (!(error instanceof Stopped)) throw error
    console.error('bananacms: stopped, nothing written')
    process.exitCode = exitCodeFor(error.signal)
  } finally {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
  }
}

// Lists and deletes the rows of `table` whose ids `select` returns, and says how
// many under `heading`
async function deleteAll(
  tx: Transaction,
  table: string,
  heading: string | undefined,
  select: string,
): Promise<number> {
  const ids = (await tx.execute(select)).rows.map((row) => String(row.id))
  if (heading) console.info(`${heading}: ${ids.length}`)
  for (const id of ids) console.info(`  ${table} ${id}`)
  if (ids.length > 0) {
    await tx.execute({
      sql: `DELETE FROM ${table} WHERE id IN (${ids.map(() => '?').join(',')})`,
      args: ids,
    })
  }
  return ids.length
}

const ORPHAN_POSTS = `
  SELECT p.id FROM post p
   WHERE NOT EXISTS (
     SELECT 1 FROM parent_post pp
       JOIN category c ON c.id = pp.parentId
      WHERE pp.postId = p.id AND pp.parentTable = 'category'
   )
`

const ORPHAN_BLOCKS = `
  SELECT b.id FROM block b
    LEFT JOIN parent_block pb ON pb.blockId = b.id
   WHERE pb.blockId IS NULL
      OR (pb.parentTable = 'post'     AND NOT EXISTS (SELECT 1 FROM post     WHERE id = pb.parentId))
      OR (pb.parentTable = 'block'    AND NOT EXISTS (SELECT 1 FROM block    WHERE id = pb.parentId))
      OR (pb.parentTable = 'page'     AND NOT EXISTS (SELECT 1 FROM page     WHERE id = pb.parentId))
      OR (pb.parentTable = 'category' AND NOT EXISTS (SELECT 1 FROM category WHERE id = pb.parentId))
      OR (pb.parentTable = 'tag'      AND NOT EXISTS (SELECT 1 FROM tag      WHERE id = pb.parentId))
      OR pb.parentTable NOT IN ('post', 'block', 'page', 'category', 'tag')
`

const ORPHAN_ATTRIBUTES = `
  SELECT a.id FROM attribute a
    LEFT JOIN parent_attribute pa ON pa.attributeId = a.id
   WHERE pa.attributeId IS NULL
      OR (pa.parentTable = 'post'     AND NOT EXISTS (SELECT 1 FROM post     WHERE id = pa.parentId))
      OR (pa.parentTable = 'category' AND NOT EXISTS (SELECT 1 FROM category WHERE id = pa.parentId))
      OR (pa.parentTable = 'page'     AND NOT EXISTS (SELECT 1 FROM page     WHERE id = pa.parentId))
      OR (pa.parentTable = 'block'    AND NOT EXISTS (SELECT 1 FROM block    WHERE id = pa.parentId))
      OR (pa.parentTable = 'tag'      AND NOT EXISTS (SELECT 1 FROM tag      WHERE id = pa.parentId))
      OR pa.parentTable NOT IN ('post', 'category', 'page', 'block', 'tag')
`

const ORPHAN_ASSETS = `
  SELECT a.id FROM asset a
   WHERE NOT EXISTS (
     SELECT 1 FROM parent_asset pa
       JOIN block b ON b.id = pa.parentId
      WHERE pa.assetId = a.id AND pa.parentTable = 'block'
   )
`

// thrown at a safe point, where the transaction can still roll back
class Stopped extends Error {
  readonly signal: NodeJS.Signals

  constructor(signal: NodeJS.Signals) {
    super(`Stopped by ${signal}`)
    this.signal = signal
  }
}

// 128 plus the signal's number, as shells report a process a signal ended
function exitCodeFor(signal: NodeJS.Signals): number {
  return 128 + constants.signals[signal]
}
