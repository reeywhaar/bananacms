import { describe, expect, it } from 'vitest'
import { createTestContext } from '../test/context.ts'
import { defineAction, invokeAction } from './actions.ts'
import { getUrl } from './context.ts'

describe('defineAction', () => {
  it("calls the action with the request's ctx before the caller's arguments", async () => {
    const add = defineAction(
      async (ctx, a: number, b: number) => `${getUrl(ctx).pathname} ${a + b}`,
    )
    const { ctx } = createTestContext({ url: 'http://site.test/poll' })
    expect(await invokeAction(add as never, [1, 2], ctx)).toBe('/poll 3')
  })

  it('gets the ctx after the arguments a form post bound to the action', async () => {
    const vote = defineAction(async (ctx, state: string, choice: string) => {
      return `${getUrl(ctx).pathname} ${state} ${choice}`
    })
    const { ctx } = createTestContext({ url: 'http://site.test/poll' })
    const bound = (vote as (...args: unknown[]) => Promise<string>).bind(null, 'open', 'yes')
    expect(await invokeAction(bound, [], ctx)).toBe('/poll open yes')
  })

  it('fails without the ctx from the CMS, whatever the arguments', async () => {
    const action = defineAction(async (_ctx, value: unknown) => value)
    await expect(action({ looks: 'like a context' })).rejects.toThrow('takes its ctx from the CMS')
  })
})
