import { and, eq, gt, ne, sql } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import { authtoken } from '@cms/lib/db/schema'

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

export class AuthTokenStore {
  constructor(private db: Db) {}

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
    const row = await this.db
      .select({ userId: authtoken.userId })
      .from(authtoken)
      .where(and(eq(authtoken.token, token), gt(authtoken.expiresAt, new Date().toISOString())))
      .get()
    return row?.userId
  }
}
