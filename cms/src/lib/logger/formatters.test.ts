import { describe, expect, it } from 'vitest'
import { DevFormatter, JsonFormatter } from './formatters.ts'
import type { LogEntry } from './Logger.ts'

const entry: LogEntry = {
  // 08:30 local time, wherever the tests run
  timestamp: new Date(2026, 8, 25, 8, 30, 0, 5).toISOString(),
  level: 'info',
  labels: ['Request', 'Auth'],
  message: 'login.success',
  fields: { traceId: '2c5ba1e4-7f0e-4b7a-9c1d-0e6f5a4b3c2d', request: { host: 'site.test' } },
  args: { userId: 'u1' },
}

describe('DevFormatter', () => {
  it('prints the time, a short trace id, a bracket per label, then the fields', () => {
    expect(new DevFormatter(false).format(entry)).toBe(
      '[08:30:00.005] [INF] [2c5ba1e4] [Request] [Auth] login.success userId=u1 request={"host":"site.test"}',
    )
  })

  it('leaves out ids and labels that are absent', () => {
    expect(new DevFormatter(false).format({ ...entry, labels: [], fields: {}, args: {} })).toBe(
      '[08:30:00.005] [INF] login.success',
    )
  })
})

describe('JsonFormatter', () => {
  it('writes the labels as an array, with the fields at the top level', () => {
    expect(JSON.parse(new JsonFormatter().format(entry))).toEqual({
      timestamp: entry.timestamp,
      level: 'info',
      labels: ['Request', 'Auth'],
      message: 'login.success',
      traceId: '2c5ba1e4-7f0e-4b7a-9c1d-0e6f5a4b3c2d',
      request: { host: 'site.test' },
      userId: 'u1',
    })
  })
})
