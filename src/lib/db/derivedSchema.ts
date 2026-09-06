import { index, integer, text, sqliteTable } from 'drizzle-orm/sqlite-core'

// authtoken lives in derived.db — a separate database from the main database.db.
// No FK to user.id because cross-database foreign keys are not supported in SQLite.
export const authtoken = sqliteTable(
  'authtoken',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    token: text('token').notNull().unique(),
    userId: text('userId').notNull(),
    expiresAt: text('expiresAt').notNull(),
  },
  (t) => ({
    userIdIdx: index('authtoken_ix_userId').on(t.userId),
  }),
)

// One row, in derived.db rather than the main database: the digest it holds
// describes the main database, and recording it there would change what the
// next backup measures.
export const backupState = sqliteTable('backup_state', {
  singleton: integer('singleton').primaryKey(),
  digest: text('digest').notNull(),
  pushedAt: integer('pushedAt').notNull(),
})

export const derivedSchema = { authtoken, backupState }

export type DerivedSchema = typeof derivedSchema
