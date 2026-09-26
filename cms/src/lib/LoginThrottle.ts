// Wrong passwords, by the username they were tried with: after MAX_FAILURES of them
// within WINDOW_MS, the name waits until the oldest of those is WINDOW_MS old. A
// name no user has counts the same, so the wait says nothing about which exist.
// It lives in the server's memory, which a restart clears.
export const MAX_FAILURES = 5
export const WINDOW_MS = 15 * 60 * 1000

// names kept at most, the ones that haven't failed lately going first
const MAX_NAMES = 10_000

export class LoginThrottle {
  private failures = new Map<string, number[]>()

  // how long `name` waits before its next try, 0 when it can try now
  waitMs(name: string, now = Date.now()): number {
    const recent = this.recent(name, now)
    if (recent.length < MAX_FAILURES) return 0
    return recent[recent.length - MAX_FAILURES] + WINDOW_MS - now
  }

  fail(name: string, now = Date.now()): void {
    const recent = this.recent(name, now)
    this.failures.delete(name)
    this.failures.set(name, [...recent, now])
    if (this.failures.size > MAX_NAMES) this.forget(now)
  }

  succeed(name: string): void {
    this.failures.delete(name)
  }

  private recent(name: string, now: number): number[] {
    return (this.failures.get(name) ?? []).filter((at) => now - at < WINDOW_MS)
  }

  // the names with no recent failure, then the ones that failed longest ago
  private forget(now: number): void {
    for (const name of this.failures.keys()) {
      if (this.recent(name, now).length === 0) this.failures.delete(name)
    }
    for (const name of this.failures.keys()) {
      if (this.failures.size <= MAX_NAMES) return
      this.failures.delete(name)
    }
  }
}
