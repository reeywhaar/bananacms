import { join } from 'node:path'
import { constants } from 'node:os'
import { openDb } from '@cms/lib/db/client'

export async function run({ dryRun }: { dryRun: boolean }): Promise<void> {
  const dataPath = requireEnv('DATA_PATH')
  const dbPath = join(dataPath, 'database.db')

  const { client } = await openDb(dbPath)

  // Without a handler, SIGTERM's default disposition kills this process on the
  // spot: the open transaction is left to SQLite's crash recovery and the
  // `finally` below never closes the client. libsql statements can't be
  // cancelled mid-flight, so the handler only raises a flag — the statement in
  // progress finishes, then the next checkpoint unwinds through the catch with
  // the transaction still rollback-able. A second signal stops waiting.
  let abortSignal: NodeJS.Signals | null = null
  const onSignal = (signal: NodeJS.Signals) => {
    if (abortSignal) {
      console.error(`\nReceived ${signal} again, exiting without unwinding.`)
      process.exit(exitCodeFor(signal))
    }
    abortSignal = signal
    console.error(`\nReceived ${signal}, stopping at the next safe point...`)
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)
  const checkAborted = () => {
    if (abortSignal) throw new CleanupAborted(abortSignal)
  }

  let inTransaction = false
  let aborted: NodeJS.Signals | null = null
  try {
    await client.execute('BEGIN')
    inTransaction = true

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
      // Unbounded: each pass can orphan the next level of nested blocks, so
      // this is the loop most likely to be running when a signal lands.
      checkAborted()
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

    checkAborted()
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

    checkAborted()
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

    checkAborted()
    if (dryRun) {
      await client.execute('ROLLBACK')
      inTransaction = false
      console.info('[dry-run] Rolled back; no changes written.')
    } else {
      await client.execute('COMMIT')
      inTransaction = false
      // Past the commit the deletions are durable and the rest is only space
      // reclamation, so a signal arriving here has nothing left to roll back —
      // and nothing to interrupt either: VACUUM can't be cancelled from this
      // side. Say so rather than appearing to ignore the signal.
      if (abortSignal) {
        console.error(`Changes are committed; VACUUM can't be interrupted, finishing it.`)
      }
      await client.execute('VACUUM')
      // VACUUM in WAL mode streams the rebuilt database through the -wal
      // file; truncate it to actually return the space.
      await client.execute('PRAGMA wal_checkpoint(TRUNCATE)')
      console.info('Cleanup complete.')
    }
  } catch (e) {
    // Only roll back while a transaction is actually open. The COMMIT/ROLLBACK
    // above end it, so a failure in VACUUM or the checkpoint has nothing to
    // undo — rolling back anyway throws "cannot rollback - no transaction is
    // active" and buries the real error.
    if (inTransaction) {
      try {
        await client.execute('ROLLBACK')
      } catch (rollbackError) {
        console.error('Rollback failed after the error below:', rollbackError)
      }
    }
    if (e instanceof CleanupAborted) aborted = e.signal
    else throw e
  } finally {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
    client.close()
  }

  // Outside the try so the client is closed before the process goes away —
  // process.exit() would skip the `finally`.
  if (aborted) {
    console.error('Aborted; no changes written.')
    process.exit(exitCodeFor(aborted))
  }
}

/** Raised at a checkpoint where the transaction is still open and undoable. */
class CleanupAborted extends Error {
  constructor(readonly signal: NodeJS.Signals) {
    super(`Aborted by ${signal}`)
  }
}

/** 128 + signal number: the shell convention for signal-terminated processes. */
function exitCodeFor(signal: NodeJS.Signals): number {
  return 128 + constants.signals[signal]
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`${name} is not set. Provide it via .env or the environment.`)
    process.exit(1)
  }
  return v
}
