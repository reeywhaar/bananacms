import { Database } from 'sqlite'

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

export class AuthTokenStore {
  constructor(private db: Database) {}

  async issue(userId: string): Promise<{ token: string; expiresAt: string }> {
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()
    await this.db.run(
      'INSERT INTO authtoken (token, userId, expiresAt) VALUES (?, ?, ?)',
      token,
      userId,
      expiresAt,
    )
    return { token, expiresAt }
  }

  async revoke(token: string): Promise<void> {
    await this.db.run('DELETE FROM authtoken WHERE token = ?', token)
  }

  async revokeAll(): Promise<void> {
    await this.db.run('DELETE FROM authtoken')
  }

  async countOthersForUser(userId: string, excludeToken: string): Promise<number> {
    const row = await this.db.get<{ c: number }>(
      'SELECT COUNT(*) AS c FROM authtoken WHERE userId = ? AND token != ? AND expiresAt > ?',
      userId,
      excludeToken,
      new Date().toISOString(),
    )
    return row?.c ?? 0
  }

  async revokeOthersForUser(userId: string, keepToken: string): Promise<number> {
    const result = await this.db.run(
      'DELETE FROM authtoken WHERE userId = ? AND token != ?',
      userId,
      keepToken,
    )
    return result.changes ?? 0
  }

  async getUserId(token: string): Promise<string | undefined> {
    const row = await this.db.get<{ userId: string }>(
      'SELECT userId FROM authtoken WHERE token = ? AND expiresAt > ?',
      token,
      new Date().toISOString(),
    )
    return row?.userId
  }
}
