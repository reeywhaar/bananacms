import { eq, sql } from 'drizzle-orm'
import { v7 } from 'uuid'
import type { Db } from '../lib/db/client.ts'
import { user } from '../lib/db/schema.ts'

export interface UserRow {
  id: string
  name: string
  password_hash: string
}

export class UserStore {
  private db: Db

  constructor(db: Db) {
    this.db = db
  }

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

  async count(): Promise<number> {
    const row = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .get()
    return row?.count ?? 0
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.db.update(user).set({ password_hash: passwordHash }).where(eq(user.id, id))
  }

  // fails when there's a user with the name already
  async create(name: string, passwordHash: string): Promise<{ id: string }> {
    const id = v7()
    await this.db.insert(user).values({ id, name, password_hash: passwordHash })
    return { id }
  }
}
