import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { sha256 } from './sha256.ts'

describe('sha256', () => {
  it("matches node:crypto's SHA-256 of the UTF-8 bytes", () => {
    for (const input of [
      '',
      'abc',
      // 56 and 64 bytes: the padding needs an extra block
      'a'.repeat(55),
      'a'.repeat(56),
      'a'.repeat(64),
      'x'.repeat(1000),
      'кошки 🐈 are great',
      '019dbcf9-c426-72aa-aa75-0c6094abc1fa:webp/80:@2x:@2x:-',
    ]) {
      expect(sha256(input), input).toBe(createHash('sha256').update(input).digest('hex'))
    }
  })
})
