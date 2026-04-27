-- Up

-- Cascade block rows when a tag is deleted (mirrors migration 8 / 17 pattern).
CREATE TRIGGER trg_tag_delete_children_blocks AFTER DELETE ON tag BEGIN
  DELETE FROM block WHERE id IN (
    SELECT blockId FROM parent_block
     WHERE parentTable = 'tag' AND parentId = old.id
  );
END;

-- Down

DROP TRIGGER trg_tag_delete_children_blocks;
