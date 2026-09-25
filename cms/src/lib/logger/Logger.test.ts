import { describe, expect, it } from 'vitest'
import { captureLogger as capture } from '../../test/logger.ts'
import { mergeFields } from './Logger.ts'

describe('Logger', () => {
  it('joins the labels of its children', () => {
    const { logger, entries } = capture()
    logger.child('ImageProcessor').child('Resizer').child('spawn').info('started')
    expect(entries[0].labels).toEqual(['ImageProcessor', 'Resizer', 'spawn'])
    expect(entries[0].message).toBe('started')
  })

  it("lets a child's field win, and merges nested objects key by key", () => {
    const { logger, entries } = capture()
    const request = logger.child('Request', {
      traceId: 't1',
      user: 'guest',
      request: { host: 'a' },
    })
    request.child('Auth', { user: 'alice', request: { path: '/manage' } }).info('login')
    expect(entries[0].fields).toEqual({
      traceId: 't1',
      user: 'alice',
      request: { host: 'a', path: '/manage' },
    })
  })

  it("keeps the call's fields apart from the loggers'", () => {
    const { logger, entries } = capture()
    logger.child('DB', { traceId: 't1' }).debug('query', { sql: 'SELECT 1', durationMs: 2 })
    expect(entries[0].fields).toEqual({ traceId: 't1' })
    expect(entries[0].args).toEqual({ sql: 'SELECT 1', durationMs: 2 })
  })

  it('shows fields set on a parent in lines its children log later', () => {
    const { logger, entries } = capture()
    const request = logger.child('Request')
    const db = request.child('DB')
    request.set({ auth: { type: 'user', id: 'u1' } })
    db.debug('query')
    expect(entries[0].fields).toEqual({ auth: { type: 'user', id: 'u1' } })
  })

  it('skips levels below its minimum', () => {
    const { logger, entries } = capture('info')
    logger.debug('hidden')
    logger.info('shown')
    logger.error('shown too')
    expect(entries.map((entry) => entry.message)).toEqual(['shown', 'shown too'])
  })
})

describe('mergeFields', () => {
  it('replaces arrays, class instances and primitives instead of merging them', () => {
    const date = new Date(0)
    expect(
      mergeFields(
        { tags: ['a'], at: new Date(1), n: 1, obj: { a: 1 } },
        { tags: ['b'], at: date, n: 2, obj: 'x' },
      ),
    ).toEqual({ tags: ['b'], at: date, n: 2, obj: 'x' })
  })

  it('leaves both inputs unchanged', () => {
    const base = { request: { host: 'a' } }
    const over = { request: { path: '/' } }
    mergeFields(base, over)
    expect(base).toEqual({ request: { host: 'a' } })
    expect(over).toEqual({ request: { path: '/' } })
  })
})
