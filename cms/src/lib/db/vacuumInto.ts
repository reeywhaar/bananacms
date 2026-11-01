import Database from 'libsql/promise'

// Copies the database at `dbPath` to `target`, which mustn't exist, with VACUUM
// INTO. Through libsql's promise driver, which runs it off the main thread:
// @libsql/client would hold the event loop for the whole copy.
export async function vacuumInto(dbPath: string, target: string): Promise<void> {
  using stack = new DisposableStack()
  const db = stack.adopt(new Database(dbPath, {}), (db) => db.close())
  // as long as the app's connections wait for a lock (client.ts)
  await db.exec('PRAGMA busy_timeout=5000')
  // exec takes no parameters, so the path goes in as an SQL string
  await db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`)
}
