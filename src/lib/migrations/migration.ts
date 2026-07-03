import type { Client, Transaction } from '@libsql/client'

export interface Migration {
  /**
   * Whether to run this migration with foreign keys enabled.
   * Set to `false` for migrations that recreate tables (DROP / copy / RENAME)
   * where SQLite's ON DELETE CASCADE would fire prematurely.
   * Defaults to `true`.
   */
  foreignKeys?: boolean
  up(tx: Transaction, derivedClient: Client): Promise<void>
  down(tx: Transaction, derivedClient: Client): Promise<void>
}

export function createMigration(migration: Migration): Migration {
  return migration
}

export type MigrationEntry = {
  id: number
  name: string
  migration: Migration
}

async function getFkState(client: Client): Promise<boolean> {
  const r = await client.execute('PRAGMA foreign_keys')
  return Number(r.rows[0]?.foreign_keys ?? 0) === 1
}

export class MigrationHandler {
  private readonly entry: MigrationEntry
  constructor(entry: MigrationEntry) {
    this.entry = entry
  }

  async runUp(client: Client, derivedClient: Client): Promise<void> {
    const { id, name, migration } = this.entry
    const fkOff = migration.foreignKeys === false
    const fkBefore = fkOff ? await getFkState(client) : false
    if (fkOff && fkBefore) await client.execute('PRAGMA foreign_keys = OFF')

    const tx = await client.transaction('write')
    try {
      await migration.up(tx, derivedClient)
      await tx.execute({ sql: 'INSERT INTO migrations (id, name) VALUES (?, ?)', args: [id, name] })
      await tx.commit()
    } finally {
      tx.close()
      if (fkOff && fkBefore) await client.execute('PRAGMA foreign_keys = ON')
    }
  }

  async runDown(client: Client, derivedClient: Client): Promise<void> {
    const { name, migration } = this.entry
    const fkOff = migration.foreignKeys === false
    const fkBefore = fkOff ? await getFkState(client) : false
    if (fkOff && fkBefore) await client.execute('PRAGMA foreign_keys = OFF')

    const tx = await client.transaction('write')
    try {
      await migration.down(tx, derivedClient)
      await tx.execute({ sql: 'DELETE FROM migrations WHERE name = ?', args: [name] })
      await tx.commit()
    } finally {
      tx.close()
      if (fkOff && fkBefore) await client.execute('PRAGMA foreign_keys = ON')
    }
  }
}
