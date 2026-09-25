import { describe, expect, it } from 'vitest'
import { createTestContext } from '../test/context.ts'
import { getRequest, getUrl } from './context.ts'
import { answer, sitemapHandlers, type RouteHandlers } from './route-handlers.ts'

const run = (method: string, handlers: RouteHandlers) =>
  answer(createTestContext({ method }).ctx, handlers, '/src/app/api/route.ts')

describe('answer', () => {
  const handlers: RouteHandlers = {
    GET: () => new Response('hello', { status: 201, headers: { 'x-greeting': 'yes' } }),
    POST: (ctx) => Response.json({ method: getRequest(ctx).method }),
  }

  it("calls the handler for the request's method", async () => {
    expect(await (await run('GET', handlers)).text()).toBe('hello')
    expect(await (await run('POST', handlers)).json()).toEqual({ method: 'POST' })
  })

  it("answers HEAD with GET's status and headers, without its body", async () => {
    const response = await run('HEAD', handlers)
    expect(response.status).toBe(201)
    expect(response.headers.get('x-greeting')).toBe('yes')
    expect(response.body).toBeNull()
  })

  it('lists the methods there are for OPTIONS, and answers any other with a 405', async () => {
    const options = await run('OPTIONS', handlers)
    expect(options.status).toBe(204)
    expect(options.headers.get('allow')).toBe('GET, HEAD, POST, OPTIONS')
    const put = await run('PUT', handlers)
    expect(put.status).toBe(405)
    expect(put.headers.get('allow')).toBe('GET, HEAD, POST, OPTIONS')
  })

  it("fails for a handler that doesn't return a Response", async () => {
    const broken = { GET: () => 'hello' } as unknown as RouteHandlers
    await expect(run('GET', broken)).rejects.toThrow(
      'GET in /src/app/api/route.ts returned string, not a Response',
    )
  })
})

describe('sitemapHandlers', () => {
  it('serves the sitemap that the ctx builds, as XML', async () => {
    const handlers = sitemapHandlers({ default: (ctx) => [{ url: `${getUrl(ctx).origin}/` }] })
    const response = await run('GET', handlers)
    expect(response.headers.get('content-type')).toBe('application/xml')
    expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
    expect(await response.text()).toContain('<loc>http://site.test/</loc>')
  })
})
