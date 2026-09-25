import { expect, it } from 'vitest'
import { cmsMigrations } from './index.ts'
import type { Migration, MigrationEntry } from './migration.ts'

// every file in this folder apart from these three is a migration
const files = import.meta.glob<{ default: Migration }>(
  ['./*.ts', '!./index.ts', '!./migration.ts', '!./*.test.ts'],
  { eager: true },
)

// The CMS's ids that aren't Date.now() timestamps. Databases record the ids they've
// run, so these stay as they are; every other id is a 13-digit Date.now()
// (docs/migrations.md).
const OLDER_IDS = [
  1700000001, 1700000002, 1700000003, 1700000005, 1700000006, 1700000007, 1700000008, 1700000009,
  1700000010, 1700000011, 1700000012, 1700000013, 1700000014, 1700000015, 1700000016, 1700000017,
  1700000018, 1700000019, 1700000020, 1700000021, 1700000022, 17830358063, 17831231180, 17831245380,
  17834727000,
]

const byId = (a: MigrationEntry, b: MigrationEntry) => a.id - b.id

it('lists every migration file under the id and name in its file name', () => {
  const fromFiles = Object.entries(files).map(([file, module]): MigrationEntry => {
    const match = /^\.\/(\d+)_(.+)\.ts$/.exec(file)
    if (!match) throw new Error(`${file} isn't named <id>_<name>.ts (see docs/migrations.md)`)
    return { id: Number(match[1]), name: match[2], migration: module.default }
  })
  expect(cmsMigrations.toSorted(byId)).toStrictEqual(fromFiles.toSorted(byId))
})

it('gives every migration apart from the older ones a 13-digit Date.now() id', () => {
  const shortIds = cmsMigrations.map(({ id }) => id).filter((id) => String(id).length !== 13)
  expect(shortIds, 'a new migration takes a Date.now() id: see docs/migrations.md').toEqual(
    OLDER_IDS,
  )
})

it('gives every migration its own name', () => {
  const names = cmsMigrations.map(({ name }) => name)
  expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([])
})
