import { describe, expect, it } from 'vitest'
import { parseMigrationFileName } from './migration.ts'

describe('parseMigrationFileName', () => {
  it('reads the Date.now() id and the name', () => {
    expect(parseMigrationFileName('src/lib/migrations/1790312345678_post_summary.ts')).toEqual({
      id: 1790312345678,
      name: 'post_summary',
    })
    expect(parseMigrationFileName('1790312345678_post_summary.js')).toEqual({
      id: 1790312345678,
      name: 'post_summary',
    })
  })

  it('rejects ids in any other shape, and points to the docs', () => {
    for (const file of [
      '0027_post_summary.ts', // a sequential number
      '1790312345_post_summary.ts', // seconds
      '017903123456_post_summary.ts', // the shape of the CMS's older ids
      'post_summary.ts', // no id
    ]) {
      expect(() => parseMigrationFileName(file), file).toThrow(
        /Date\.now\(\) id.*docs\/migrations\.md/,
      )
    }
  })

  it('suggests a file name with a fresh id', () => {
    expect(() => parseMigrationFileName('src/lib/migrations/0027_post_summary.ts')).toThrow(
      /"src\/lib\/migrations\/0027_post_summary\.ts".*"\d{13}_post_summary\.ts"/,
    )
  })
})
