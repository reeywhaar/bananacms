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
  (t) => [index('authtoken_ix_userId').on(t.userId)],
)

// One row, in derived.db rather than the main database: the digest it holds
// describes the main database, and recording it there would change what the
// next backup measures.
export const backupState = sqliteTable('backup_state', {
  singleton: integer('singleton').primaryKey(),
  digest: text('digest').notNull(),
  pushedAt: integer('pushedAt').notNull(),
})

// Invitations, which create the user named in them, and recovery links, which
// set a new password for a user: each lets someone set a password once, until it
// expires (PasswordTokenStore). A row keeps the token's SHA-256, not the token.
export const passwordToken = sqliteTable(
  'password_token',
  {
    id: integer('id').primaryKey(),
    tokenHash: text('tokenHash').notNull().unique(),
    kind: text('kind', { enum: ['invite', 'recover'] }).notNull(),
    // a recovery link's user
    userId: text('userId'),
    // the name an invitation creates
    userName: text('userName'),
    expiresAt: text('expiresAt').notNull(),
  },
  (t) => [
    index('password_token_ix_userId').on(t.userId),
    index('password_token_ix_userName').on(t.userName),
  ],
)

export const derivedSchema = { authtoken, backupState, passwordToken }

export type DerivedSchema = typeof derivedSchema
