import { createHash } from 'node:crypto'
import { createMigration } from './migration.ts'

// Sessions in derived.db as their token's SHA-256, as the password tokens are
// kept, so a copy of the database holds no token that signs anyone in. The tokens
// there are hashed in place, and their sessions carry on.
export default createMigration({
  async up(_tx, derivedClient) {
    const { rows } = await derivedClient.execute('SELECT id, token FROM authtoken')
    await derivedClient.batch(
      [
        'ALTER TABLE authtoken RENAME COLUMN token TO tokenHash',
        ...rows.map((row) => ({
          sql: 'UPDATE authtoken SET tokenHash = ? WHERE id = ?',
          args: [createHash('sha256').update(String(row.token)).digest('hex'), row.id],
        })),
      ],
      'write',
    )
  },

  // a hash doesn't give its token back, so the sessions end
  async down(_tx, derivedClient) {
    await derivedClient.batch(
      ['DELETE FROM authtoken', 'ALTER TABLE authtoken RENAME COLUMN tokenHash TO token'],
      'write',
    )
  },
})
