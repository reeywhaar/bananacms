import { createMigration } from './migration.ts'

export default createMigration({
  async up(client) {
    await client.executeMultiple(`
CREATE VIRTUAL TABLE post_fts USING fts5(
  postId UNINDEXED,
  locale UNINDEXED,
  content,
  tokenize='unicode61 remove_diacritics 1'
);
    `)
  },

  async down(client) {
    await client.execute('DROP TABLE IF EXISTS post_fts')
  },
})
