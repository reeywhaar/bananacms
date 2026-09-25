import { createMigration } from './migration.ts'

export default createMigration({
  async up(client) {
    await client.executeMultiple(`
CREATE TABLE IF NOT EXISTS asset (
  id        TEXT    PRIMARY KEY,
  filename  TEXT    NOT NULL,
  mime      TEXT    NOT NULL,
  data      BLOB    NOT NULL,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE block_asset (
  blockId TEXT NOT NULL,
  assetId TEXT NOT NULL,

  PRIMARY KEY (blockId, assetId),

  CONSTRAINT block_asset_fk_blockId FOREIGN KEY (blockId)
    REFERENCES block (id) ON DELETE CASCADE,
  CONSTRAINT block_asset_fk_assetId FOREIGN KEY (assetId)
    REFERENCES asset (id) ON DELETE CASCADE
);

CREATE TRIGGER trg_block_asset_delete AFTER DELETE ON block_asset BEGIN
  DELETE FROM asset
    WHERE id = old.assetId
      AND NOT EXISTS (SELECT 1 FROM block_asset WHERE assetId = old.assetId);
END;
    `)
  },

  async down(client) {
    await client.executeMultiple(`
DROP TRIGGER trg_block_asset_delete;
DROP TABLE block_asset;
DROP TABLE asset;
    `)
  },
})
