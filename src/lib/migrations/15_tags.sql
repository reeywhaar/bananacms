-- Up

CREATE TABLE tag (
  id        TEXT NOT NULL PRIMARY KEY,
  shortid   TEXT NOT NULL DEFAULT '',
  name      TEXT NOT NULL,
  slug      TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX tag_ix_shortid ON tag (shortid);

CREATE TABLE parent_tag (
  tagId       TEXT NOT NULL,
  parentId    TEXT NOT NULL,
  parentTable TEXT NOT NULL,

  PRIMARY KEY (tagId, parentId, parentTable),
  CONSTRAINT parent_tag_fk_tagId FOREIGN KEY (tagId)
    REFERENCES tag (id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX parent_tag_ix_parent ON parent_tag (parentTable, parentId);

CREATE TRIGGER trg_tag_delete AFTER DELETE ON tag BEGIN
  DELETE FROM localizations WHERE key LIKE 'tag:' || old.id || ':%';
END;

-- SQLite FKs can't target polymorphic columns, so cascade parent_tag rows manually.
CREATE TRIGGER trg_post_delete_parent_tags AFTER DELETE ON post BEGIN
  DELETE FROM parent_tag WHERE parentTable = 'post' AND parentId = old.id;
END;

-- Down

DROP TRIGGER trg_post_delete_parent_tags;
DROP TRIGGER trg_tag_delete;
DROP INDEX parent_tag_ix_parent;
DROP TABLE parent_tag;
DROP INDEX tag_ix_shortid;
DROP TABLE tag;
