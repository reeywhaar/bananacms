import { createMigration } from './migration.ts'

export default createMigration({
  async up(client) {
    await client.execute('DROP TRIGGER trg_block_asset_delete')
  },

  async down(client) {
    await client.executeMultiple(`
CREATE TRIGGER trg_block_asset_delete AFTER DELETE ON block_asset BEGIN
  DELETE FROM asset
    WHERE id = old.assetId
      AND NOT EXISTS (SELECT 1 FROM block_asset WHERE assetId = old.assetId);
END;
    `)
  },
})
