import { describe, expect, it } from 'vitest'
import { declaredOverLimit, limitBody, type BodyLimit } from './body-limit.ts'

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request('http://site.test/', { method: 'POST', body, headers })
const limitOf = (bytes: number): BodyLimit => ({ maxBytes: () => bytes, exceeded: false })

describe('limitBody', () => {
  it('reads a body within the limit as it is', async () => {
    const limit = limitOf(10)
    expect(await limitBody(post('0123456789'), limit).text()).toBe('0123456789')
    expect(limit.exceeded).toBe(false)
  })

  it('fails the read of a body past the limit, and says so', async () => {
    const limit = limitOf(10)
    await expect(limitBody(post('0123456789+'), limit).text()).rejects.toThrow('over 10 bytes')
    expect(limit.exceeded).toBe(true)
  })

  it('asks for the limit as the body is read', async () => {
    let bytes = 100
    const limit: BodyLimit = { maxBytes: () => bytes, exceeded: false }
    const request = limitBody(post('x'.repeat(50)), limit)
    bytes = 10
    await expect(request.text()).rejects.toThrow('over 10 bytes')
    expect(limit.exceeded).toBe(true)
  })

  it('keeps the headers, so a form still parses', async () => {
    const form = new FormData()
    form.append('name', 'value')
    const parsed = await limitBody(post(form), limitOf(10_000)).formData()
    expect(parsed.get('name')).toBe('value')
  })

  it("takes a request of the servers' own class, which isn't Request", async () => {
    const native = post('0123456789', { 'x-test': 'yes' })
    const theirs = {
      url: native.url,
      method: native.method,
      headers: native.headers,
      signal: native.signal,
      body: native.body,
    } as Request
    const limited = limitBody(theirs, limitOf(10))
    expect(limited.headers.get('x-test')).toBe('yes')
    expect(await limited.text()).toBe('0123456789')
  })

  it('leaves a request without a body as it is', () => {
    const request = new Request('http://site.test/')
    expect(limitBody(request, limitOf(0))).toBe(request)
  })
})

describe('declaredOverLimit', () => {
  it("goes by the request's Content-Length", () => {
    const limit = limitOf(10)
    expect(declaredOverLimit(post('x', { 'content-length': '11' }), limit)).toBe(true)
    expect(declaredOverLimit(post('x', { 'content-length': '10' }), limit)).toBe(false)
    expect(declaredOverLimit(post('x'), limit)).toBe(false)
  })
})
