import { createMigration } from './migration.ts'

export default createMigration({
  async up(client) {
    await client.execute({
      sql: `INSERT INTO category (id, shortid, name, slug) VALUES (?, ?, ?, ?)`,
      args: ['1E982CC4-47AB-4ADB-AB1F-24182319AB77', '2319AB77', 'Pages', 'pages'],
    })
  },

  async down(client) {
    await client.execute({
      sql: `DELETE FROM category WHERE id = ?`,
      args: ['1E982CC4-47AB-4ADB-AB1F-24182319AB77'],
    })
  },
})
