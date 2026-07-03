import { createMigration } from './migration.ts'

export default createMigration({
  async up(client) {
    await client.executeMultiple(`
CREATE INDEX post_ix_slug ON post (slug);
CREATE INDEX category_ix_slug ON category (slug);
CREATE INDEX tag_ix_slug ON tag (slug);
    `)
  },

  async down(client) {
    await client.executeMultiple(`
DROP INDEX tag_ix_slug;
DROP INDEX category_ix_slug;
DROP INDEX post_ix_slug;
    `)
  },
})
