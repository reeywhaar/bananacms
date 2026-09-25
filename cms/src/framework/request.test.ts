import { describe, expect, it } from 'vitest'
import {
  createRscRenderRequest,
  isManagePath,
  isNojs,
  parseRenderRequest,
  toNojsUrl,
} from './request.ts'

describe('parseRenderRequest', () => {
  it('reads a _.rsc suffix as an RSC request for the path without it', () => {
    const parsed = parseRenderRequest(new Request('http://site.test/notes/1_.rsc?q=1'))
    expect(parsed).toMatchObject({ isRsc: true, isAction: false })
    expect(parsed.url.href).toBe('http://site.test/notes/1?q=1')
    expect(parsed.request.url).toBe('http://site.test/notes/1?q=1')
  })

  it('reads the server action id of an RSC post', () => {
    const parsed = parseRenderRequest(
      new Request('http://site.test/manage_.rsc', {
        method: 'POST',
        headers: { 'x-rsc-action': 'action-id' },
      }),
    )
    expect(parsed).toMatchObject({ isRsc: true, isAction: true, actionId: 'action-id' })
  })

  it('rejects an RSC post without an action id', () => {
    const request = new Request('http://site.test/manage_.rsc', { method: 'POST' })
    expect(() => parseRenderRequest(request)).toThrow('Missing action id')
  })

  it('reads other requests as HTML, and posts as form submissions', () => {
    expect(parseRenderRequest(new Request('http://site.test/page1'))).toMatchObject({
      isRsc: false,
      isAction: false,
    })
    const post = parseRenderRequest(new Request('http://site.test/manage', { method: 'POST' }))
    expect(post).toMatchObject({ isRsc: false, isAction: true })
    expect(post.actionId).toBeUndefined()
  })
})

describe('createRscRenderRequest', () => {
  it('builds requests that parseRenderRequest reads back', () => {
    const navigation = parseRenderRequest(createRscRenderRequest('http://site.test/notes?q=1'))
    expect(navigation).toMatchObject({ isRsc: true, isAction: false })
    expect(navigation.url.href).toBe('http://site.test/notes?q=1')

    const action = parseRenderRequest(
      createRscRenderRequest('http://site.test/manage', { id: 'action-id', body: 'args' }),
    )
    expect(action).toMatchObject({ isRsc: true, isAction: true, actionId: 'action-id' })
  })
})

describe('no-JS mode', () => {
  it('is a query flag', () => {
    expect(isNojs(new URL('http://site.test/page2?__nojs'))).toBe(true)
    expect(isNojs(new URL('http://site.test/page2'))).toBe(false)
  })

  it('keeps the rest of the URL', () => {
    expect(toNojsUrl(new URL('http://site.test/page2'))).toBe('/page2?__nojs')
    expect(toNojsUrl(new URL('http://site.test/page2?a=1'))).toBe('/page2?a=1&__nojs')
  })
})

describe('isManagePath', () => {
  it('matches /manage and paths below it only', () => {
    expect(isManagePath('/manage')).toBe(true)
    expect(isManagePath('/manage/notes')).toBe(true)
    expect(isManagePath('/manager')).toBe(false)
    expect(isManagePath('/')).toBe(false)
  })
})
