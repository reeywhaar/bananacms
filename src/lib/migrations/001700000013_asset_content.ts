import { createMigration } from './migration.ts'

export default createMigration({
  async up(client) {
    await client.executeMultiple(`
ALTER TABLE asset ADD COLUMN content TEXT;

UPDATE asset
   SET content = '{"resolution":"@1x"}'
 WHERE mime LIKE 'image/%';
    `)
  },

  async down(client) {
    await client.execute('ALTER TABLE asset DROP COLUMN content')
  },
})
