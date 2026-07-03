import { describe, expect, it } from 'vitest'
import { applyDiff, createDiff } from './diff'

const OLD = [
  'BEGIN;',
  "INSERT INTO t VALUES ('a');",
  "INSERT INTO t VALUES ('b');",
  'COMMIT;',
  '',
].join('\n')
const NEW = [
  'BEGIN;',
  "INSERT INTO t VALUES ('a');",
  "INSERT INTO t VALUES ('c');",
  'COMMIT;',
  '',
].join('\n')

describe('createDiff / applyDiff', () => {
  it('roundtrips', () => {
    const patch = createDiff(OLD, NEW)
    expect(applyDiff(OLD, patch)).toBe(NEW)
  })

  it('handles identical inputs', () => {
    const patch = createDiff(OLD, OLD)
    expect(applyDiff(OLD, patch)).toBe(OLD)
  })

  it('returns null when the patch does not fit the base', () => {
    const patch = createDiff(OLD, NEW)
    expect(applyDiff(NEW, patch)).toBeNull()
  })
})
