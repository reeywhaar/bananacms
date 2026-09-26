import { describe, expect, it } from 'vitest'
import { LoginThrottle, MAX_FAILURES, WINDOW_MS } from './LoginThrottle.ts'

const SECOND = 1000

describe('LoginThrottle', () => {
  it('lets a name fail MAX_FAILURES times, then makes it wait for the oldest to age', () => {
    const throttle = new LoginThrottle()
    for (let i = 0; i < MAX_FAILURES; i++) {
      expect(throttle.waitMs('alice', i * SECOND)).toBe(0)
      throttle.fail('alice', i * SECOND)
    }
    const now = MAX_FAILURES * SECOND
    expect(throttle.waitMs('alice', now)).toBe(WINDOW_MS - now)
    // the first failure is WINDOW_MS old then, so one try is back
    expect(throttle.waitMs('alice', WINDOW_MS)).toBe(0)
  })

  it('counts failures within the window only', () => {
    const throttle = new LoginThrottle()
    for (let i = 0; i < MAX_FAILURES - 1; i++) throttle.fail('alice', 0)
    throttle.fail('alice', WINDOW_MS)
    expect(throttle.waitMs('alice', WINDOW_MS)).toBe(0)
  })

  it('keeps names apart, and forgets a name that signs in', () => {
    const throttle = new LoginThrottle()
    for (let i = 0; i < MAX_FAILURES; i++) throttle.fail('alice', 0)
    expect(throttle.waitMs('bob', 0)).toBe(0)
    throttle.succeed('alice')
    expect(throttle.waitMs('alice', 0)).toBe(0)
  })
})
