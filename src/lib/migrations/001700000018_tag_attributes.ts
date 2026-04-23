import { createMigration } from './migration.ts'

export default createMigration({
  async up(client) {
    await client.executeMultiple(`
CREATE TRIGGER trg_tag_delete_children_attributes AFTER DELETE ON tag BEGIN
  DELETE FROM attribute WHERE id IN (
    SELECT attributeId FROM parent_attribute WHERE parentTable = 'tag' AND parentId = old.id
  );
END;
    `)
  },

  async down(client) {
    await client.execute('DROP TRIGGER trg_tag_delete_children_attributes')
  },
})
