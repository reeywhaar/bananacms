import { describe, expect, it } from 'vitest'
import { createTestContext } from '../test/context.ts'
import { runMiddleware, type Middleware } from './middleware.ts'

const page = async () => new Response('page')

describe('runMiddleware', () => {
  it('runs the middleware in order, around the end of the chain', async () => {
    const { ctx } = createTestContext()
    const calls: string[] = []
    const around =
      (name: string): Middleware =>
      async (_ctx, next) => {
        calls.push(`${name} before`)
        const response = await next()
        calls.push(`${name} after`)
        return response
      }
    const response = await runMiddleware(ctx, [around('a'), around('b')], async () => {
      calls.push('page')
      return page()
    })
    expect(calls).toEqual(['a before', 'b before', 'page', 'b after', 'a after'])
    expect(await response.text()).toBe('page')
  })

  it("lets a middleware change the rest of the chain's response", async () => {
    const { ctx } = createTestContext()
    const response = await runMiddleware(
      ctx,
      [
        async (_ctx, next) => {
          const response = await next()
          response.headers.set('x-frame-options', 'DENY')
          return response
        },
      ],
      page,
    )
    expect(response.headers.get('x-frame-options')).toBe('DENY')
  })

  it('lets a middleware answer without calling next', async () => {
    const { ctx } = createTestContext()
    let rendered = false
    const response = await runMiddleware(
      ctx,
      [async () => new Response(null, { status: 302, headers: { location: '/login' } })],
      async () => {
        rendered = true
        return page()
      },
    )
    expect(response.status).toBe(302)
    expect(rendered).toBe(false)
  })

  it('passes a value a middleware adds on to the rest of the chain', async () => {
    const LOCALE = Symbol('Locale')
    const { ctx } = createTestContext()
    const setLocale: Middleware = async (ctx, next) => {
      ctx.set(LOCALE, 'ru')
      return next()
    }
    const response = await runMiddleware(
      ctx,
      [setLocale],
      async () => new Response(String(ctx.get(LOCALE))),
    )
    expect(await response.text()).toBe('ru')
  })

  it('rejects a second call to next', async () => {
    const { ctx } = createTestContext()
    const twice: Middleware = async (_ctx, next) => {
      await next()
      return next()
    }
    await expect(runMiddleware(ctx, [twice], page)).rejects.toThrow('called next() more than once')
  })
})
