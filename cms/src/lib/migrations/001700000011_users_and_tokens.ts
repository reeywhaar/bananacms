import { createMigration } from './migration.ts'

export default createMigration({
  async up(client) {
    await client.executeMultiple(`
CREATE TABLE user (
  id            TEXT NOT NULL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

DROP TABLE authtoken;

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
  },

  async down(client) {
    await client.executeMultiple(`
DROP INDEX authtoken_ix_userId;
DROP INDEX authtoken_ix_token;
DROP TABLE authtoken;
DROP TABLE user;

CREATE TABLE authtoken (
  id    INTEGER PRIMARY KEY,
  token TEXT    NOT NULL
);
    `)
  },
})
