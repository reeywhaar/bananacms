import { describe, expect, it } from 'vitest'
import type { AttributeData } from '#cms/services/AttributeStore.ts'
import { attributeKeyError, attributesInvalid } from './AttributesEditor.tsx'

const attr = (id: string, key: string, text = ''): AttributeData => ({
  id,
  key,
  translatable: false,
  text,
})

describe('attributeKeyError', () => {
  it('takes a key, its value empty or not', () => {
    const year = attr('a', 'year', '1903')
    const notes = attr('b', 'notes')
    expect(attributeKeyError([year, notes], year)).toBeNull()
    expect(attributeKeyError([year, notes], notes)).toBeNull()
  })

  it('refuses no key, blank or with a value', () => {
    const blank = attr('a', '')
    const spaces = attr('b', '  ', 'France')
    expect(attributeKeyError([blank, spaces], blank)).toBe('Required')
    expect(attributeKeyError([blank, spaces], spaces)).toBe('Required')
  })

  it("refuses another attribute's key, on both", () => {
    const first = attr('a', 'year', '1903')
    const second = attr('b', 'year ', '1904')
    expect(attributeKeyError([first, second], first)).toBe('Used twice')
    expect(attributeKeyError([first, second], second)).toBe('Used twice')
  })
})

describe('attributesInvalid', () => {
  it('is whether any key is refused', () => {
    expect(attributesInvalid([])).toBe(false)
    expect(attributesInvalid([attr('a', 'year'), attr('b', 'notes')])).toBe(false)
    expect(attributesInvalid([attr('a', 'year'), attr('b', '')])).toBe(true)
  })
})
