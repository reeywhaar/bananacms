import { createMigration } from './migration.ts'

export default createMigration({
  async up(client) {
    await client.executeMultiple(`
CREATE TABLE page (
  id  TEXT NOT NULL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE
);

CREATE TRIGGER trg_page_delete_children_blocks AFTER DELETE ON page BEGIN
  DELETE FROM block WHERE id IN (
    SELECT blockId FROM parent_block
     WHERE parentTable = 'page' AND parentId = old.id
  );
END;

CREATE TRIGGER trg_page_delete AFTER DELETE ON page BEGIN
  DELETE FROM localizations WHERE key LIKE 'page:' || old.id || ':%';
END;
    `)
  },

  async down(client) {
    await client.executeMultiple(`
DROP TRIGGER trg_page_delete;
DROP TRIGGER trg_page_delete_children_blocks;
DROP TABLE page;
    `)
  },
})
