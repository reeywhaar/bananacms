import { createMigration } from './migration.ts'

export default createMigration({
  async up(client) {
    await client.executeMultiple(`
CREATE TABLE category (
  id    TEXT NOT NULL PRIMARY KEY,
  name  TEXT NOT NULL,
  slug  TEXT NOT NULL
);

CREATE TABLE post (
  id         TEXT NOT NULL PRIMARY KEY,
  categoryId TEXT NOT NULL,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL DEFAULT '',
  createdAt  TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt  TEXT NOT NULL DEFAULT (datetime('now')),
  status     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft')),

  CONSTRAINT post_fk_categoryId FOREIGN KEY (categoryId)
    REFERENCES category (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE block (
  id      TEXT NOT NULL PRIMARY KEY,
  postId  TEXT,
  blockId TEXT,
  type    TEXT NOT NULL,
  content TEXT NOT NULL,

  CONSTRAINT block_fk_postId  FOREIGN KEY (postId)  REFERENCES post  (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT block_fk_blockId FOREIGN KEY (blockId) REFERENCES block (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE authtoken (
  id    INTEGER PRIMARY KEY,
  token TEXT    NOT NULL
);

CREATE INDEX post_ix_categoryId ON post  (categoryId);
CREATE INDEX block_ix_postId    ON block (postId);
    `)
  },

  async down(client) {
    await client.executeMultiple(`
DROP INDEX block_ix_postId;
DROP INDEX post_ix_categoryId;
DROP TABLE authtoken;
DROP TABLE block;
DROP TABLE post;
DROP TABLE category;
    `)
  },
})
