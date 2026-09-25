import { createMigration } from './migration.ts'

// Both indexes duplicate an existing one and only amplify writes:
// localizations_ix_key is a pure prefix of the unique (key, locale) index,
// and authtoken_ix_token duplicates the UNIQUE constraint's implicit index.
export default createMigration({
  async up(tx, derivedClient) {
    await tx.execute('DROP INDEX IF EXISTS localizations_ix_key')
    await derivedClient.execute('DROP INDEX IF EXISTS authtoken_ix_token')
  },

  async down(tx, derivedClient) {
    await tx.execute('CREATE INDEX localizations_ix_key ON localizations (key)')
    await derivedClient.execute('CREATE INDEX authtoken_ix_token ON authtoken (token)')
  },
})
