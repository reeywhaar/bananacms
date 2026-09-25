import { createMigration } from './migration.ts'

// password_token, in derived.db: the invitations and recovery links that
// `bananacms user create` and `user reset` make (PasswordTokenStore).
export default createMigration({
  async up(_tx, derivedClient) {
    await derivedClient.executeMultiple(`
CREATE TABLE IF NOT EXISTS password_token (
  id        INTEGER PRIMARY KEY,
  tokenHash TEXT NOT NULL UNIQUE,
  kind      TEXT NOT NULL CHECK (kind IN ('invite', 'recover')),
  userId    TEXT,
  userName  TEXT,
  expiresAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS password_token_ix_userId   ON password_token (userId);
CREATE INDEX IF NOT EXISTS password_token_ix_userName ON password_token (userName);
    `)
  },

  async down(_tx, derivedClient) {
    await derivedClient.executeMultiple(`
DROP INDEX IF EXISTS password_token_ix_userName;
DROP INDEX IF EXISTS password_token_ix_userId;
DROP TABLE IF EXISTS password_token;
    `)
  },
})
