-- Up

-- The trigger caused a FK violation during saveByPostId: deleting all blocks
-- cascades to block_asset, which fires the trigger and deletes assets before
-- the new block_asset rows are re-inserted. Orphan cleanup is now done
-- explicitly in application code after re-inserting.
DROP TRIGGER trg_block_asset_delete;

-- Down

CREATE TRIGGER trg_block_asset_delete AFTER DELETE ON block_asset BEGIN
  DELETE FROM asset
    WHERE id = old.assetId
      AND NOT EXISTS (SELECT 1 FROM block_asset WHERE assetId = old.assetId);
END;
