import { createMigration } from './migration.ts'

export default createMigration({
  async up(client) {
    await client.executeMultiple(`
CREATE TRIGGER trg_tag_delete_children_blocks AFTER DELETE ON tag BEGIN
  DELETE FROM block WHERE id IN (
    SELECT blockId FROM parent_block
     WHERE parentTable = 'tag' AND parentId = old.id
  );
END;
    `)
  },

  async down(client) {
    await client.execute('DROP TRIGGER trg_tag_delete_children_blocks')
  },
})
