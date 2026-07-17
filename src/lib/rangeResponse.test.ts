import { describe, expect, it } from 'vitest'
import { parseRange, rangeResponse } from './rangeResponse'

describe('parseRange', () => {
  const size = 100

  it('returns null when there is no Range header', () => {
    expect(parseRange(null, size)).toBeNull()
  })

  it('parses an open-ended range', () => {
    expect(parseRange('bytes=0-', size)).toEqual({ start: 0, end: 99 })
    expect(parseRange('bytes=50-', size)).toEqual({ start: 50, end: 99 })
  })

  it('parses a closed range', () => {
    expect(parseRange('bytes=0-49', size)).toEqual({ start: 0, end: 49 })
    expect(parseRange('bytes=10-19', size)).toEqual({ start: 10, end: 19 })
  })

  it('clamps an end past the last byte', () => {
    expect(parseRange('bytes=50-1000', size)).toEqual({ start: 50, end: 99 })
  })

  it('parses a suffix range', () => {
    expect(parseRange('bytes=-20', size)).toEqual({ start: 80, end: 99 })
  })

  it('clamps a suffix larger than the file to the whole file', () => {
    expect(parseRange('bytes=-1000', size)).toEqual({ start: 0, end: 99 })
  })

  it('treats a zero-length suffix as unsatisfiable', () => {
    expect(parseRange('bytes=-0', size)).toBe('unsatisfiable')
  })

  it('treats a start at or past the end as unsatisfiable', () => {
    expect(parseRange('bytes=100-', size)).toBe('unsatisfiable')
    expect(parseRange('bytes=200-300', size)).toBe('unsatisfiable')
  })

  it('ignores malformed headers by serving the full body', () => {
    expect(parseRange('bytes=-', size)).toBeNull()
    expect(parseRange('bytes=abc', size)).toBeNull()
    expect(parseRange('bytes=10-5', size)).toBeNull()
    expect(parseRange('kilobytes=0-', size)).toBeNull()
    expect(parseRange('', size)).toBeNull()
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseRange('  bytes=0-9  ', size)).toEqual({ start: 0, end: 9 })
  })
})

describe('rangeResponse', () => {
  const data = Buffer.from('0123456789')
  const headers = { 'Content-Type': 'audio/mpeg' }
  const body = (start: number, end: number) => new Uint8Array(data.subarray(start, end + 1))

  const build = (range: string | null) =>
    rangeResponse({ range, size: data.length, headers, body })

  it('serves the full body with Accept-Ranges when no range is requested', async () => {
    const res = build(null)
    expect(res.status).toBe(200)
    expect(res.headers.get('Accept-Ranges')).toBe('bytes')
    expect(res.headers.get('Content-Length')).toBe('10')
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(await res.text()).toBe('0123456789')
  })

  it('serves a 206 with Content-Range and the sliced body', async () => {
    const res = build('bytes=2-5')
    expect(res.status).toBe(206)
    expect(res.headers.get('Content-Range')).toBe('bytes 2-5/10')
    expect(res.headers.get('Content-Length')).toBe('4')
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(await res.text()).toBe('2345')
  })

  it('serves a 206 for a suffix range', async () => {
    const res = build('bytes=-3')
    expect(res.status).toBe(206)
    expect(res.headers.get('Content-Range')).toBe('bytes 7-9/10')
    expect(await res.text()).toBe('789')
  })

  it('serves a 416 with Content-Range for an out-of-bounds range', async () => {
    const res = build('bytes=100-200')
    expect(res.status).toBe(416)
    expect(res.headers.get('Content-Range')).toBe('bytes */10')
    expect(await res.text()).toBe('')
  })
})
