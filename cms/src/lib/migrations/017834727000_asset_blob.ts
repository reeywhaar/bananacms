import { createMigration } from './migration.ts'

// Moves the large image blob out of the asset row. SQLite stores a row's
// columns in order, so any column after a big blob (content here) is only
// reachable by walking the blob's overflow-page chain — metadata reads were
// paying O(blob size) per row. With the blob in a sibling table, asset reads
// never touch it, and future asset columns can't reintroduce the problem.
export default createMigration({
  // down() recreates the asset table (DROP / copy / RENAME).
  foreignKeys: false,
  async up(tx) {
    await tx.executeMultiple(`
CREATE TABLE asset_blob (
  id   TEXT PRIMARY KEY REFERENCES asset (id) ON DELETE CASCADE,
  data BLOB NOT NULL
);
INSERT INTO asset_blob (id, data) SELECT id, data FROM asset;
ALTER TABLE asset DROP COLUMN data;
    `)
  },

  async down(tx) {
    await tx.executeMultiple(`
CREATE TABLE asset_restored (
  id        TEXT    PRIMARY KEY,
  filename  TEXT    NOT NULL,
  mime      TEXT    NOT NULL,
  data      BLOB    NOT NULL,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  content   TEXT
);
INSERT INTO asset_restored (id, filename, mime, data, createdAt, content)
  SELECT asset.id, asset.filename, asset.mime, asset_blob.data, asset.createdAt, asset.content
  FROM asset JOIN asset_blob ON asset_blob.id = asset.id;
DROP TABLE asset;
ALTER TABLE asset_restored RENAME TO asset;
DROP TABLE asset_blob;
    `)
  },
})
