import { createMigration } from './migration.ts'

// backup_state lives in derived.db, not the main database, because the answer
// it records is *about* the main database: writing it there would change the
// thing being measured, so every backup would make the next one look due.
export default createMigration({
  async up(_tx, derivedClient) {
    await derivedClient.executeMultiple(`
CREATE TABLE IF NOT EXISTS backup_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  digest    TEXT    NOT NULL,
  pushedAt  INTEGER NOT NULL
);
    `)
  },

  async down(_tx, derivedClient) {
    await derivedClient.executeMultiple(`
DROP TABLE IF EXISTS backup_state;
    `)
  },
})
