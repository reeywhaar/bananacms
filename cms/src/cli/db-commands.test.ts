import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseMigrationFileName } from '../lib/migrations/migration.ts'
import { cleanupAssets } from './assets-cleanup.ts'
import { backfillAudioMeta, backfillImageDimensions, backfillMigrationIds } from './db-backfill.ts'
import { cleanupDatabase } from './db-cleanup.ts'
import { addMigration, checkMigrations, migrate } from './migrate.ts'
import { openSiteDatabases } from './site-databases.ts'

// Each test gets a site directory of its own, with its data and assets in it
let root: string
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'bananacms-cli-'))
  vi.stubEnv('DATA_PATH', 'private')
  vi.stubEnv('ASSETS_DIRECTORY', 'private/assets')
  mkdirSync(path.join(root, 'private/assets'), { recursive: true })
  for (const method of ['info', 'warn', 'error'] as const) {
    vi.spyOn(console, method).mockImplementation(() => {})
  }
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  rmSync(root, { recursive: true, force: true })
})

const sql = async (statements: string) => {
  using databases = await openSiteDatabases(root)
  await databases.main.client.executeMultiple(statements)
}
const ids = async (table: string) => {
  using databases = await openSiteDatabases(root)
  return (await databases.main.client.execute(`SELECT id FROM ${table} ORDER BY id`)).rows.map(
    (row) => String(row.id),
  )
}

describe('db migration run', () => {
  it("creates both databases, and runs the CMS's migrations and the site's", async () => {
    mkdirSync(path.join(root, 'src/lib/migrations'), { recursive: true })
    writeFileSync(
      path.join(root, 'src/lib/migrations/1790000000000_site_notes.ts'),
      `export default {
        async up(tx) { await tx.execute('CREATE TABLE site_note (id TEXT PRIMARY KEY)') },
        async down(tx) { await tx.execute('DROP TABLE site_note') },
      }`,
    )
    await migrate(root)
    expect(existsSync(path.join(root, 'private/derived.db'))).toBe(true)
    await sql("INSERT INTO site_note (id) VALUES ('a')")
    // and again, with nothing left to run
    await migrate(root)
    expect(await ids('site_note')).toEqual(['a'])
  })

  it('fails on foreign key violations left in the database', async () => {
    await migrate(root)
    await sql(`
      PRAGMA foreign_keys = OFF;
      INSERT INTO parent_post (postId, parentId, parentTable) VALUES ('no-post', 'no-category', 'category');
    `)
    await expect(migrate(root)).rejects.toThrow('Foreign key violations after migrating')
  })

  it('needs DATA_PATH', async () => {
    vi.stubEnv('DATA_PATH', '')
    await expect(migrate(root)).rejects.toThrow('DATA_PATH is not set')
  })
})

describe('db migration check', () => {
  const siteMigration = (id: number, sql: string) => {
    mkdirSync(path.join(root, 'src/lib/migrations'), { recursive: true })
    writeFileSync(
      path.join(root, `src/lib/migrations/${id}_site_notes.ts`),
      `export default {
        async up(tx) { await tx.execute(${JSON.stringify(sql)}) },
        async down(tx) { await tx.execute('DROP TABLE site_note') },
      }`,
    )
  }
  const printed = () => vi.mocked(console.info).mock.calls.map((call: unknown[]) => String(call[0]))

  it('passes a database the migrations have made, site migrations included', async () => {
    siteMigration(1790000000000, 'CREATE TABLE site_note (id TEXT PRIMARY KEY)')
    await migrate(root)
    await checkMigrations(root)
    expect(printed().at(-1)).toMatch(/^bananacms: the databases are what the \d+ migrations make$/)
  })

  it("names the migrations that haven't run, and those run that it doesn't have", async () => {
    await migrate(root)
    siteMigration(1790000000000, 'CREATE TABLE site_note (id TEXT PRIMARY KEY)')
    await sql("INSERT INTO migrations (id, name) VALUES (1790000000001, 'from_elsewhere')")
    await expect(checkMigrations(root)).rejects.toThrow('3 differences')
    expect(printed()).toEqual(
      expect.arrayContaining([
        "  migration 1790000000000 site_notes hasn't run",
        "  migration 1790000000001 from_elsewhere has run, and there's no such migration",
        '  database.db: no table site_note, which the migrations make',
      ]),
    )
  })

  it('names the tables and indexes that differ from what the migrations make', async () => {
    await migrate(root)
    await sql(`
      ALTER TABLE tag ADD COLUMN colour TEXT;
      CREATE INDEX tag_ix_colour ON tag (colour);
    `)
    await expect(checkMigrations(root)).rejects.toThrow('2 differences')
    expect(printed()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^ {2}database\.db: table tag is .*colour TEXT.*, and the migrations make /,
        ),
        "  database.db: index tag_ix_colour, which the migrations don't make",
      ]),
    )
  })

  it('needs the databases', async () => {
    await expect(checkMigrations(root)).rejects.toThrow('No database at')
  })
})

describe('db migration create', () => {
  it('creates a migration file with a timestamp id, which imports from @reeywhaar/bananacms', async () => {
    const file = await addMigration(root, 'add_notes')
    expect(parseMigrationFileName(file)).toMatchObject({ name: 'add_notes' })
    expect(path.dirname(file)).toBe(path.join(root, 'src/lib/migrations'))
    expect(readFileSync(file, 'utf8')).toContain(
      "import { createMigration } from '@reeywhaar/bananacms'",
    )
  })

  it('takes snake_case names only', async () => {
    await expect(addMigration(root, 'Add notes')).rejects.toThrow("isn't snake_case")
  })
})

describe('db cleanup', () => {
  beforeEach(async () => {
    await migrate(root)
    await sql(`
      INSERT INTO category (id, name, slug) VALUES ('c1', 'Kept', 'kept');
      INSERT INTO post (id, shortid, name) VALUES ('p-kept', 'k1', 'In a category'), ('p-orphan', 'o1', 'In none');
      INSERT INTO parent_post (postId, parentId, parentTable) VALUES ('p-kept', 'c1', 'category');
      INSERT INTO block (id, content) VALUES ('b-kept', '{}'), ('b-orphan', '{}'), ('b-nested', '{}');
      INSERT INTO parent_block (blockId, parentId, parentTable) VALUES
        ('b-kept', 'p-kept', 'post'), ('b-orphan', 'p-orphan', 'post'), ('b-nested', 'b-orphan', 'block');
      INSERT INTO attribute (id, key) VALUES ('a-kept', 'k'), ('a-orphan', 'k');
      INSERT INTO parent_attribute (attributeId, parentId, parentTable) VALUES ('a-kept', 'p-kept', 'post');
      INSERT INTO asset (id, filename, mime) VALUES ('s-kept', 'a.png', 'image/png'), ('s-orphan', 'b.png', 'image/png');
      INSERT INTO parent_asset (assetId, parentId, parentTable) VALUES ('s-kept', 'b-kept', 'block');
    `)
  })

  it('lists what it would delete on a dry run, and deletes nothing', async () => {
    await cleanupDatabase(root, { dryRun: true })
    expect(await ids('post')).toEqual(['p-kept', 'p-orphan'])
    expect(await ids('block')).toEqual(['b-kept', 'b-nested', 'b-orphan'])
  })

  it('deletes posts in no category, then the blocks under them, nested ones too, and what nothing uses', async () => {
    await cleanupDatabase(root)
    expect(await ids('post')).toEqual(['p-kept'])
    expect(await ids('block')).toEqual(['b-kept'])
    expect(await ids('attribute')).toEqual(['a-kept'])
    expect(await ids('asset')).toEqual(['s-kept'])
  })

  it('needs a database to clean', async () => {
    vi.stubEnv('DATA_PATH', 'elsewhere')
    await expect(cleanupDatabase(root)).rejects.toThrow('No database at')
  })
})

describe('db backfill', () => {
  beforeEach(() => migrate(root))

  it("fills in images' dimensions from the file in the database", async () => {
    const png = await sharp({
      create: { width: 3, height: 2, channels: 3, background: 'orange' },
    })
      .png()
      .toBuffer()
    using databases = await openSiteDatabases(root)
    const { client } = databases.main
    await client.execute(
      "INSERT INTO asset (id, filename, mime, content) VALUES ('i1', 'i.png', 'image/png', '{}')",
    )
    await client.execute({ sql: "INSERT INTO asset_blob (id, data) VALUES ('i1', ?)", args: [png] })

    expect(await backfillImageDimensions(root, { dryRun: true })).toEqual({ updated: 1, failed: 0 })
    const content = async () =>
      JSON.parse(
        String((await client.execute("SELECT content FROM asset WHERE id = 'i1'")).rows[0].content),
      )
    expect(await content()).toEqual({})
    await backfillImageDimensions(root)
    expect(await content()).toEqual({ width: 3, height: 2 })
  })

  it("fills in audio's duration from the cached file, keeping what's there", async () => {
    // a second of silence, as 8 kHz mono 8-bit WAV
    const samples = 8000
    const wav = Buffer.alloc(44 + samples, 0x80)
    wav.write('RIFF', 0)
    wav.writeUInt32LE(36 + samples, 4)
    wav.write('WAVEfmt ', 8)
    wav.writeUInt32LE(16, 16)
    wav.writeUInt16LE(1, 20)
    wav.writeUInt16LE(1, 22)
    wav.writeUInt32LE(8000, 24)
    wav.writeUInt32LE(8000, 28)
    wav.writeUInt16LE(1, 32)
    wav.writeUInt16LE(8, 34)
    wav.write('data', 36)
    wav.writeUInt32LE(samples, 40)
    writeFileSync(path.join(root, 'private/assets/w1'), wav)
    await sql(
      `INSERT INTO asset (id, filename, mime, content) VALUES ('w1', 'w.wav', 'audio/wav', '{"title":"Kept"}')`,
    )

    expect(await backfillAudioMeta(root)).toEqual({ updated: 1, failed: 0 })
    using databases = await openSiteDatabases(root)
    const content = JSON.parse(
      String(
        (await databases.main.client.execute("SELECT content FROM asset WHERE id = 'w1'")).rows[0]
          .content,
      ),
    )
    expect(content).toMatchObject({ type: 'audio', title: 'Kept', duration: 1 })
  })

  it('gives the migrations table the ids of the files it names', async () => {
    await sql("UPDATE migrations SET id = 3 WHERE name = 'initial'")
    expect(await backfillMigrationIds(root, { dryRun: true })).toEqual({ updated: 1 })
    expect(await backfillMigrationIds(root)).toEqual({ updated: 1 })
    using databases = await openSiteDatabases(root)
    const row = (
      await databases.main.client.execute("SELECT id FROM migrations WHERE name = 'initial'")
    ).rows[0]
    expect(Number(row.id)).toBe(1700000001)
    expect(await backfillMigrationIds(root)).toEqual({ updated: 0 })
  })
})

describe('assets cleanup', () => {
  const kept = '01a0d75d-70c6-75de-bf9b-e42213d15194'
  const gone = '0199aaaa-0000-7000-8000-000000000000'
  const files = () => readdirSync(path.join(root, 'private/assets')).sort()

  beforeEach(async () => {
    await migrate(root)
    await sql(`INSERT INTO asset (id, filename, mime) VALUES ('${kept}', 'a.png', 'image/png')`)
    const dir = path.join(root, 'private/assets')
    for (const name of [kept, `${kept}-6b0f3c2a9d1e`, gone, `${gone}-6b0f3c2a9d1e`]) {
      writeFileSync(path.join(dir, name), 'x')
    }
    // a variant that links to an original deleted before it
    symlinkSync(path.join(dir, 'missing'), path.join(dir, `${gone}-000000000000`))
  })

  it("deletes the files of assets that aren't in the database, links included", async () => {
    expect(await cleanupAssets(root, { dryRun: true })).toEqual({ kept: 2, removed: 3 })
    expect(files()).toHaveLength(5)
    expect(await cleanupAssets(root)).toEqual({ kept: 2, removed: 3 })
    expect(files()).toEqual([kept, `${kept}-6b0f3c2a9d1e`])
  })

  it('needs ASSETS_DIRECTORY', async () => {
    vi.stubEnv('ASSETS_DIRECTORY', '')
    await expect(cleanupAssets(root)).rejects.toThrow('ASSETS_DIRECTORY is not set')
  })
})
