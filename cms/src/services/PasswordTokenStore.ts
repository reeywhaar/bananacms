import { randomBytes } from 'node:crypto'
import { and, eq, gt, lte } from 'drizzle-orm'
import { MANAGE_PATH } from '../framework/request.ts'
import type { DerivedDb } from '../lib/db/client.ts'
import { passwordToken } from '../lib/db/derivedSchema.ts'
import { sha256hex } from './password.ts'

// An invitation creates the user it names, and a recovery link sets a new
// password for an existing one
export type PasswordTokenKind = 'invite' | 'recover'

// whom a token is for
export type PasswordTokenFor =
  { kind: 'invite'; userName: string } | { kind: 'recover'; userId: string }

export const PASSWORD_TOKEN_TTL_MS: Record<PasswordTokenKind, number> = {
  invite: 7 * 24 * 60 * 60 * 1000,
  recover: 24 * 60 * 60 * 1000,
}

// the admin's pages for each kind of link, which take the token in `?token=`
export const PASSWORD_TOKEN_PATHS: Record<PasswordTokenKind, string> = {
  invite: `${MANAGE_PATH}/invite`,
  recover: `${MANAGE_PATH}/recover`,
}

// The tokens in the links `bananacms user create` and `user reset` print, kept
// in derived.db. Each works once, until it expires, and a new one for the same
// user replaces the ones before it. The table keeps each token's SHA-256, so a
// copy of derived.db, like the one in a backup, holds no token that works.
export class PasswordTokenStore {
  private db: DerivedDb

  constructor(db: DerivedDb) {
    this.db = db
  }

  // a new token for `target`, and how many earlier ones for it that replaces
  async issue(
    target: PasswordTokenFor,
  ): Promise<{ token: string; expiresAt: string; replaced: number }> {
    const now = Date.now()
    // the expired ones go too, whoever they were for
    await this.db
      .delete(passwordToken)
      .where(lte(passwordToken.expiresAt, new Date(now).toISOString()))
    const { rowsAffected: replaced } = await this.db
      .delete(passwordToken)
      .where(
        target.kind === 'invite'
          ? and(eq(passwordToken.kind, 'invite'), eq(passwordToken.userName, target.userName))
          : and(eq(passwordToken.kind, 'recover'), eq(passwordToken.userId, target.userId)),
      )

    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(now + PASSWORD_TOKEN_TTL_MS[target.kind]).toISOString()
    await this.db.insert(passwordToken).values({
      tokenHash: sha256hex(token),
      kind: target.kind,
      userId: target.kind === 'recover' ? target.userId : null,
      userName: target.kind === 'invite' ? target.userName : null,
      expiresAt,
    })
    return { token, expiresAt, replaced }
  }

  // whom `token` is for, while it works
  async find(token: string): Promise<PasswordTokenFor | undefined> {
    const row = await this.db.select(COLUMNS).from(passwordToken).where(working(token)).get()
    return row && target(row)
  }

  // Uses up `token`, which then works no more: whom it was for, while it worked
  async consume(token: string): Promise<PasswordTokenFor | undefined> {
    const row = await this.db.delete(passwordToken).where(working(token)).returning(COLUMNS).get()
    return row && target(row)
  }
}

const COLUMNS = {
  kind: passwordToken.kind,
  userId: passwordToken.userId,
  userName: passwordToken.userName,
}

const working = (token: string) =>
  and(
    eq(passwordToken.tokenHash, sha256hex(token)),
    gt(passwordToken.expiresAt, new Date().toISOString()),
  )

function target(row: {
  kind: PasswordTokenKind
  userId: string | null
  userName: string | null
}): PasswordTokenFor | undefined {
  if (row.kind === 'invite' && row.userName !== null) {
    return { kind: 'invite', userName: row.userName }
  }
  if (row.kind === 'recover' && row.userId !== null) return { kind: 'recover', userId: row.userId }
  return undefined
}
