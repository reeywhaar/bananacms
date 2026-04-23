import { eq, sql } from 'drizzle-orm'
import { v7 } from 'uuid'
import { type Db } from '@cms/lib/db/client'
import { user } from '@cms/lib/db/schema'

export interface UserRow {
  id: string
  name: string
  password_hash: string
}

export class UserStore {
  constructor(private db: Db) {}

  async findByName(name: string): Promise<UserRow | undefined> {
    return this.db
      .select({ id: user.id, name: user.name, password_hash: user.password_hash })
      .from(user)
      .where(eq(user.name, name))
      .get()
  }

  async findById(id: string): Promise<UserRow | undefined> {
    return this.db
      .select({ id: user.id, name: user.name, password_hash: user.password_hash })
      .from(user)
      .where(eq(user.id, id))
      .get()
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.db.update(user).set({ password_hash: passwordHash }).where(eq(user.id, id))
  }

  async upsertByName(name: string, passwordHash: string): Promise<{ id: string }> {
    const id = v7()
    const row = await this.db
      .insert(user)
      .values({ id, name, password_hash: passwordHash })
      .onConflictDoUpdate({
        target: user.name,
        set: { password_hash: sql`excluded.password_hash` },
      })
      .returning({ id: user.id })
      .get()
    if (!row) throw new Error('upsertByName: no row returned')
    return { id: row.id }
  }
}
