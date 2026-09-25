import { createMigration } from './migration.ts'

// authtoken moves to derived.db. Migrate data, then drop from the main database.
export default createMigration({
  async up(tx, derivedClient) {
    const { rows } = await tx.execute('SELECT id, token, userId, expiresAt FROM authtoken')

    await derivedClient.executeMultiple(`
CREATE TABLE IF NOT EXISTS authtoken (
  id        INTEGER PRIMARY KEY,
  token     TEXT NOT NULL UNIQUE,
  userId    TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS authtoken_ix_token  ON authtoken (token);
CREATE INDEX IF NOT EXISTS authtoken_ix_userId ON authtoken (userId);
    `)

    for (const row of rows) {
      await derivedClient.execute({
        sql: 'INSERT OR IGNORE INTO authtoken (id, token, userId, expiresAt) VALUES (?, ?, ?, ?)',
        args: [row.id, row.token, row.userId, row.expiresAt],
      })
    }

    await tx.execute(`DROP TABLE authtoken`)
  },

  async down(tx, derivedClient) {
    const { rows } = await derivedClient.execute(
      'SELECT id, token, userId, expiresAt FROM authtoken',
    )

    await derivedClient.executeMultiple(`
DROP INDEX IF EXISTS authtoken_ix_userId;
DROP INDEX IF EXISTS authtoken_ix_token;
DROP TABLE IF EXISTS authtoken;
    `)

    await tx.executeMultiple(`
CREATE TABLE authtoken (
  id        INTEGER PRIMARY KEY,
  token     TEXT NOT NULL UNIQUE,
  userId    TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  CONSTRAINT authtoken_fk_userId FOREIGN KEY (userId)
    REFERENCES user (id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX authtoken_ix_token  ON authtoken (token);
CREATE INDEX authtoken_ix_userId ON authtoken (userId);
    `)

    for (const row of rows) {
      await tx.execute({
        sql: 'INSERT OR IGNORE INTO authtoken (id, token, userId, expiresAt) VALUES (?, ?, ?, ?)',
        args: [row.id, row.token, row.userId, row.expiresAt],
      })
    }
  },
})
