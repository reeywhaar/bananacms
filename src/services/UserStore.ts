import { Database } from 'sqlite'
import { v7 } from 'uuid'

export interface UserRow {
  id: string
  name: string
  password_hash: string
}

export class UserStore {
  constructor(private db: Database) {}

  async findByName(name: string): Promise<UserRow | undefined> {
    return this.db.get<UserRow>(
      'SELECT id, name, password_hash FROM user WHERE name = ?',
      name,
    )
  }

  async findById(id: string): Promise<UserRow | undefined> {
    return this.db.get<UserRow>('SELECT id, name, password_hash FROM user WHERE id = ?', id)
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.db.run('UPDATE user SET password_hash = ? WHERE id = ?', passwordHash, id)
  }

  async upsertByName(name: string, passwordHash: string): Promise<{ id: string }> {
    const row = await this.db.get<{ id: string }>(
      'INSERT INTO user (id, name, password_hash) VALUES (?, ?, ?) ' +
        'ON CONFLICT(name) DO UPDATE SET password_hash = excluded.password_hash ' +
        'RETURNING id',
      v7(),
      name,
      passwordHash,
    )
    if (!row) throw new Error('upsertByName: no row returned')
    return { id: row.id }
  }
}
