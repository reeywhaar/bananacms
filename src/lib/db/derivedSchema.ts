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

export const derivedSchema = { authtoken }

export type DerivedSchema = typeof derivedSchema
