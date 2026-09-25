import { and, eq, gt, ne, sql } from 'drizzle-orm'
import type { DerivedDb } from '../lib/db/client.ts'
import { authtoken } from '../lib/db/derivedSchema.ts'

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

export class AuthTokenStore {
  private db: DerivedDb

  constructor(db: DerivedDb) {
    this.db = db
  }

  async issue(userId: string): Promise<{ token: string; expiresAt: string }> {
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()
    await this.db.insert(authtoken).values({ token, userId, expiresAt })
    return { token, expiresAt }
  }

  async revoke(token: string): Promise<void> {
    await this.db.delete(authtoken).where(eq(authtoken.token, token))
  }

  async revokeAll(): Promise<void> {
    await this.db.delete(authtoken)
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.delete(authtoken).where(eq(authtoken.userId, userId))
  }

  async countOthersForUser(userId: string, excludeToken: string): Promise<number> {
    const row = await this.db
      .select({ c: sql<number>`COUNT(*)` })
      .from(authtoken)
      .where(
        and(
          eq(authtoken.userId, userId),
          ne(authtoken.token, excludeToken),
          gt(authtoken.expiresAt, new Date().toISOString()),
        ),
      )
      .get()
    return row?.c ?? 0
  }

  async revokeOthersForUser(userId: string, keepToken: string): Promise<number> {
    const result = await this.db
      .delete(authtoken)
      .where(and(eq(authtoken.userId, userId), ne(authtoken.token, keepToken)))
    return result.rowsAffected ?? 0
  }

  async getUserId(token: string): Promise<string | undefined> {
    return (await this.getTokenData(token))?.userId
  }

  async getTokenData(token: string): Promise<{ userId: string; expiresAt: string } | undefined> {
    const row = await this.db
      .select({ userId: authtoken.userId, expiresAt: authtoken.expiresAt })
      .from(authtoken)
      .where(and(eq(authtoken.token, token), gt(authtoken.expiresAt, new Date().toISOString())))
      .get()
    return row ?? undefined
  }

  // returns the new expiry
  async extend(token: string): Promise<string> {
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()
    await this.db.update(authtoken).set({ expiresAt }).where(eq(authtoken.token, token))
    return expiresAt
  }
}
