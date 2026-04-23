-- Up
-- Must run with foreign_keys = OFF (scripts/migrate.js handles this).
-- SQLite's DROP TABLE propagates ON DELETE CASCADE to referring tables,
-- which would wipe block_asset and the parent_block/parent_post rows we
-- populate below. Disabling FKs for the migration avoids that cascade;
-- foreign_key_check is run at the end of the migration script.

CREATE TABLE parent_block (
  blockId     TEXT NOT NULL PRIMARY KEY,
  parentId    TEXT NOT NULL,
  parentTable TEXT NOT NULL,

  CONSTRAINT parent_block_fk_blockId FOREIGN KEY (blockId)
    REFERENCES block (id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX parent_block_ix_parent ON parent_block (parentTable, parentId);

CREATE TABLE parent_post (
  postId      TEXT NOT NULL PRIMARY KEY,
  parentId    TEXT NOT NULL,
  parentTable TEXT NOT NULL,

  CONSTRAINT parent_post_fk_postId FOREIGN KEY (postId)
    REFERENCES post (id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX parent_post_ix_parent ON parent_post (parentTable, parentId);

INSERT INTO parent_block (blockId, parentId, parentTable)
SELECT id, postId, 'post'
  FROM block WHERE postId IS NOT NULL;

INSERT INTO parent_block (blockId, parentId, parentTable)
SELECT id, blockId, 'block'
  FROM block WHERE blockId IS NOT NULL;

INSERT INTO parent_post (postId, parentId, parentTable)
SELECT id, categoryId, 'category'
  FROM post;

-- SQLite cannot DROP COLUMN for columns referenced by a (self-)FK, so we
-- recreate block and post without the obsolete columns. defer_foreign_keys
-- keeps FKs from block_asset and parent_block satisfied across the swap.

DROP INDEX block_ix_postId;
DROP INDEX post_ix_categoryId;

CREATE TABLE block_new (
  id      TEXT NOT NULL PRIMARY KEY,
  type    TEXT NOT NULL,
  content TEXT NOT NULL
);
INSERT INTO block_new (id, type, content)
  SELECT id, type, content FROM block;
DROP TABLE block;
ALTER TABLE block_new RENAME TO block;

CREATE TABLE post_new (
  id        TEXT NOT NULL PRIMARY KEY,
  shortid   TEXT NOT NULL DEFAULT '',
  name      TEXT NOT NULL,
  slug      TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  status    TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft'))
);
INSERT INTO post_new (id, shortid, name, slug, createdAt, updatedAt, status)
  SELECT id, shortid, name, slug, createdAt, updatedAt, status FROM post;
DROP TABLE post;
ALTER TABLE post_new RENAME TO post;

CREATE UNIQUE INDEX post_ix_shortid ON post (shortid);

-- Recreate triggers from migration 2 that were dropped with their host tables.
CREATE TRIGGER trg_post_delete AFTER DELETE ON post BEGIN
  DELETE FROM localizations WHERE key LIKE 'post:' || old.id || ':%';
END;

CREATE TRIGGER trg_block_delete AFTER DELETE ON block BEGIN
  DELETE FROM localizations WHERE key LIKE 'block:' || old.id || ':%';
END;

-- Polymorphic cascade triggers (SQLite FKs can't reference polymorphic cols).
CREATE TRIGGER trg_post_delete_children_blocks AFTER DELETE ON post BEGIN
  DELETE FROM block WHERE id IN (
    SELECT blockId FROM parent_block
     WHERE parentTable = 'post' AND parentId = old.id
  );
END;

CREATE TRIGGER trg_block_delete_children_blocks AFTER DELETE ON block BEGIN
  DELETE FROM block WHERE id IN (
    SELECT blockId FROM parent_block
     WHERE parentTable = 'block' AND parentId = old.id
  );
END;

CREATE TRIGGER trg_category_delete_children_posts AFTER DELETE ON category BEGIN
  DELETE FROM post WHERE id IN (
    SELECT postId FROM parent_post
     WHERE parentTable = 'category' AND parentId = old.id
  );
END;

-- Down
-- Also requires foreign_keys = OFF for the same reason.

DROP TRIGGER trg_category_delete_children_posts;
DROP TRIGGER trg_block_delete_children_blocks;
DROP TRIGGER trg_post_delete_children_blocks;
DROP TRIGGER trg_block_delete;
DROP TRIGGER trg_post_delete;

CREATE TABLE block_old (
  id      TEXT NOT NULL PRIMARY KEY,
  postId  TEXT,
  blockId TEXT,
  type    TEXT NOT NULL,
  content TEXT NOT NULL,

  CONSTRAINT block_fk_postId  FOREIGN KEY (postId)  REFERENCES post  (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT block_fk_blockId FOREIGN KEY (blockId) REFERENCES block_old (id) ON UPDATE CASCADE ON DELETE CASCADE
);
INSERT INTO block_old (id, postId, blockId, type, content)
  SELECT b.id,
         (SELECT parentId FROM parent_block WHERE blockId = b.id AND parentTable = 'post'),
         (SELECT parentId FROM parent_block WHERE blockId = b.id AND parentTable = 'block'),
         b.type, b.content
    FROM block b;
DROP TABLE block;
ALTER TABLE block_old RENAME TO block;

CREATE TABLE post_old (
  id         TEXT NOT NULL PRIMARY KEY,
  categoryId TEXT NOT NULL,
  shortid    TEXT NOT NULL DEFAULT '',
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL DEFAULT '',
  createdAt  TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt  TEXT NOT NULL DEFAULT (datetime('now')),
  status     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft')),

  CONSTRAINT post_fk_categoryId FOREIGN KEY (categoryId)
    REFERENCES category (id) ON UPDATE CASCADE ON DELETE CASCADE
);
INSERT INTO post_old (id, categoryId, shortid, name, slug, createdAt, updatedAt, status)
  SELECT p.id,
         (SELECT parentId FROM parent_post WHERE postId = p.id AND parentTable = 'category'),
         p.shortid, p.name, p.slug, p.createdAt, p.updatedAt, p.status
    FROM post p;
DROP TABLE post;
ALTER TABLE post_old RENAME TO post;

CREATE INDEX post_ix_categoryId ON post  (categoryId);
CREATE INDEX block_ix_postId    ON block (postId);
CREATE UNIQUE INDEX post_ix_shortid ON post (shortid);

CREATE TRIGGER trg_post_delete AFTER DELETE ON post BEGIN
  DELETE FROM localizations WHERE key LIKE 'post:' || old.id || ':%';
END;

CREATE TRIGGER trg_block_delete AFTER DELETE ON block BEGIN
  DELETE FROM localizations WHERE key LIKE 'block:' || old.id || ':%';
END;

DROP INDEX parent_post_ix_parent;
DROP INDEX parent_block_ix_parent;
DROP TABLE parent_post;
DROP TABLE parent_block;
