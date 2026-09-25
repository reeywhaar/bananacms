import { createMigration } from './migration.ts'

export default createMigration({
  async up(client) {
    await client.execute(`
UPDATE asset
   SET content = json_set(COALESCE(content, '{}'), '$.output_as', json('{"type":"original"}'))
 WHERE mime LIKE 'image/%';
    `)
  },

  async down(client) {
    await client.execute(`
UPDATE asset
   SET content = json_remove(content, '$.output_as')
 WHERE mime LIKE 'image/%';
    `)
  },
})
