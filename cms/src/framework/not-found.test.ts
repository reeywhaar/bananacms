import { describe, expect, it } from 'vitest'
import { isNotFoundError, notFound } from './not-found.ts'

describe('notFound', () => {
  it('throws an error that isNotFoundError recognizes', () => {
    let error: unknown
    try {
      notFound()
    } catch (caught) {
      error = caught
    }
    expect(isNotFoundError(error)).toBe(true)
  })

  it('tells other errors apart', () => {
    expect(isNotFoundError(new Error('Not found'))).toBe(false)
    expect(isNotFoundError(null)).toBe(false)
    expect(isNotFoundError('not found')).toBe(false)
  })
})
