import { createMigration } from './migration.ts'

// Must run with foreign_keys = OFF.
// SQLite's DROP TABLE propagates ON DELETE CASCADE to referring tables;
// disabling FKs across the migration avoids collateral cascades.
export default createMigration({
  foreignKeys: false,

  async up(client) {
    await client.executeMultiple(`
CREATE TABLE parent_asset (
  assetId     TEXT NOT NULL,
  parentId    TEXT NOT NULL,
  parentTable TEXT NOT NULL,

  PRIMARY KEY (assetId, parentId, parentTable),

  CONSTRAINT parent_asset_fk_assetId FOREIGN KEY (assetId)
    REFERENCES asset (id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX parent_asset_ix_parent ON parent_asset (parentTable, parentId);

CREATE TRIGGER trg_block_delete_parent_asset AFTER DELETE ON block BEGIN
  DELETE FROM parent_asset
    WHERE parentTable = 'block' AND parentId = old.id;
END;

INSERT INTO parent_asset (assetId, parentId, parentTable)
SELECT assetId, blockId, 'block'
  FROM block_asset;

DROP TABLE block_asset;
    `)
  },

  async down(client) {
    await client.executeMultiple(`
CREATE TABLE block_asset (
  blockId TEXT NOT NULL,
  assetId TEXT NOT NULL,

  PRIMARY KEY (blockId, assetId),

  CONSTRAINT block_asset_fk_blockId FOREIGN KEY (blockId)
    REFERENCES block (id) ON DELETE CASCADE,
  CONSTRAINT block_asset_fk_assetId FOREIGN KEY (assetId)
    REFERENCES asset (id) ON DELETE CASCADE
);

INSERT INTO block_asset (blockId, assetId)
SELECT parentId, assetId
  FROM parent_asset WHERE parentTable = 'block';

DROP TRIGGER trg_block_delete_parent_asset;
DROP INDEX parent_asset_ix_parent;
DROP TABLE parent_asset;
    `)
  },
})
