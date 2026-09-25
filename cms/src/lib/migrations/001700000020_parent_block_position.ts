import { createMigration } from './migration.ts'

export default createMigration({
  async up(client) {
    await client.executeMultiple(`
ALTER TABLE parent_block ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

UPDATE parent_block AS pb
   SET position = (
     SELECT rn FROM (
       SELECT blockId,
              ROW_NUMBER() OVER (PARTITION BY parentTable, parentId ORDER BY blockId ASC) - 1 AS rn
         FROM parent_block
     ) s
     WHERE s.blockId = pb.blockId
   );

CREATE INDEX parent_block_ix_parent_position
  ON parent_block (parentTable, parentId, position);
    `)
  },

  async down(client) {
    await client.executeMultiple(`
DROP INDEX parent_block_ix_parent_position;
ALTER TABLE parent_block DROP COLUMN position;
    `)
  },
})
