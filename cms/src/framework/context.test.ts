import { describe, expect, it } from 'vitest'
import { createTestContext } from '../test/context.ts'
import {
  Context,
  createRequestContext,
  getAuth,
  getDb,
  getLogger,
  getParams,
  getRequest,
  getResponseRedirect,
  getResponseStatus,
  getUrl,
  isRscRequest,
  setAuth,
  setResponseRedirect,
  setResponseStatus,
} from './context.ts'
import { Cookies } from './cookies.ts'
import { captureLogger } from '../test/logger.ts'

describe('Context', () => {
  it("reads a value from its own scope, or else from its parent's", () => {
    const NAME = Symbol('Name')
    const LOG = Symbol('Log')
    const parent = new Context().set(NAME, 'target').set(LOG, 'build log')
    const child = parent.child().set(NAME, 'tool')
    expect(child.get(NAME)).toBe('tool')
    expect(child.get(LOG)).toBe('build log')
    expect(parent.get(NAME)).toBe('target')
  })

  it('lets a child scope unset what its parent has', () => {
    const { ctx } = createTestContext()
    setAuth(ctx, { user: { id: 'u1', name: 'alice' }, token: 't', tokenExpiresAt: '' })
    const child = setAuth(ctx.child(), undefined)
    expect(getAuth(child)).toBeUndefined()
    expect(getAuth(ctx)?.user.name).toBe('alice')
  })

  it('names the value a context is missing', () => {
    const { ctx } = createTestContext()
    expect(() => getDb(ctx)).toThrow('The context has no Db')
  })

  it("starts a request's context as a child of the app's", () => {
    const APP_VALUE = Symbol('AppValue')
    const app = new Context().set(APP_VALUE, 'kept for the whole server')
    const { logger } = captureLogger()
    const url = new URL('http://site.test/posts/1?x=2')
    const ctx = createRequestContext(app, {
      request: new Request(url),
      url,
      params: { id: '1' },
      logger: logger.child('Request'),
      rsc: true,
    })
    expect(ctx.get(APP_VALUE)).toBe('kept for the whole server')
    expect(getRequest(ctx).url).toBe('http://site.test/posts/1?x=2')
    expect(getUrl(ctx).pathname).toBe('/posts/1')
    expect(getParams(ctx)).toEqual({ id: '1' })
    expect(getLogger(ctx).labels).toEqual(['Request'])
    expect(isRscRequest(ctx)).toBe(true)
  })

  it("carries the response's status and redirect, which a child scope shares", () => {
    const { ctx } = createTestContext()
    expect(getResponseStatus(ctx)).toBeUndefined()
    setResponseStatus(ctx.child(), 404)
    setResponseRedirect(ctx.child(), { url: '/elsewhere', status: 307 })
    expect(getResponseStatus(ctx)).toBe(404)
    expect(getResponseRedirect(ctx)).toEqual({ url: '/elsewhere', status: 307 })
  })

  it('keeps its values out of its own fields, where serializers look', () => {
    const { ctx } = createTestContext({ cookie: 'auth=secret-token' })
    setAuth(ctx, { user: { id: 'u1', name: 'alice' }, token: 'secret-token', tokenExpiresAt: '' })
    ctx.set(Symbol('Locale'), 'en')
    const child = ctx.child()
    expect(Object.keys(ctx)).toEqual([])
    expect(JSON.stringify({ ctx, child })).toBe('{"ctx":{},"child":{}}')
  })
})

describe('Cookies', () => {
  it("parses the request's cookies and skips malformed ones", () => {
    const cookies = new Cookies('a=1; b=hello%20world; broken=%E0%A4%A; no-value')
    expect(cookies.get('a')).toBe('1')
    expect(cookies.get('b')).toBe('hello world')
    expect(cookies.get('broken')).toBeUndefined()
    expect(cookies.get('no-value')).toBeUndefined()
  })

  it('makes cookies set during the request readable, and queues Set-Cookie headers', () => {
    const cookies = new Cookies('auth=old')
    cookies.set('auth', 'new value', { maxAge: 60 })
    expect(cookies.get('auth')).toBe('new value')
    cookies.delete('auth')
    expect(cookies.get('auth')).toBeUndefined()
    expect(cookies.setCookieHeaders).toEqual([
      'auth=new%20value; Path=/; Max-Age=60; HttpOnly; SameSite=Lax',
      'auth=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
    ])
  })
})
