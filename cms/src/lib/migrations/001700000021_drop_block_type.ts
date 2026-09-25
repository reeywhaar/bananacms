import { createMigration } from './migration.ts'

export default createMigration({
  async up(client) {
    await client.execute('ALTER TABLE block DROP COLUMN type')
  },

  async down(client) {
    await client.executeMultiple(`
ALTER TABLE block ADD COLUMN type TEXT NOT NULL DEFAULT '';
UPDATE block SET type = json_extract(content, '$.type');
    `)
  },
})
