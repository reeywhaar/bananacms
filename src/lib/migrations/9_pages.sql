-- Up

CREATE TABLE page (
  id  TEXT NOT NULL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE
);

-- Delete blocks when a page is deleted (via parent_block with parentTable='page')
CREATE TRIGGER trg_page_delete_children_blocks AFTER DELETE ON page BEGIN
  DELETE FROM block WHERE id IN (
    SELECT blockId FROM parent_block
     WHERE parentTable = 'page' AND parentId = old.id
  );
END;

-- Delete localizations when a page is deleted
CREATE TRIGGER trg_page_delete AFTER DELETE ON page BEGIN
  DELETE FROM localizations WHERE key LIKE 'page:' || old.id || ':%';
END;

-- Down

DROP TRIGGER trg_page_delete;
DROP TRIGGER trg_page_delete_children_blocks;
DROP TABLE page;
