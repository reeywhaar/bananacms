import { describe, expect, it } from 'vitest'
import { pluralize } from './pluralize'

describe('pluralize', () => {
  it('returns the singular form for 1', () => {
    expect(pluralize(1, { one: 'session', other: 'sessions' })).toBe('session')
  })

  it('returns the plural form for 2', () => {
    expect(pluralize(2, { one: 'session', other: 'sessions' })).toBe('sessions')
  })

  it('returns the zero form when provided', () => {
    expect(pluralize(0, { zero: 'none', one: 'one', other: 'many' })).toBe('none')
  })

  it('uses locale-specific plural rules for Russian', () => {
    expect(pluralize(2, { one: 'one', few: 'few', many: 'many', other: 'other' }, 'ru')).toBe('few')
  })

  it('falls back to other when the locale rule form is not provided', () => {
    expect(pluralize(2, { one: 'one', other: 'other' }, 'en')).toBe('other')
  })
})
