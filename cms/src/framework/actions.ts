import { Context } from './context.ts'

// Defines a server action that gets the request's ctx before its own arguments.
// Callers pass only the arguments: `login(formData)` runs `fn(ctx, formData)`.
//
//   'use server'
//   export const vote = defineAction(async (ctx, formData: FormData) => { … })
//
// The ctx comes from the CMS, which runs every action with the request's ctx after
// the browser's arguments (invokeAction). A browser's arguments are plain data, so
// it can't send a Context itself.
export function defineAction<Args extends unknown[], Result>(
  fn: (ctx: Context, ...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return async (...args) => {
    const ctx = args.at(-1)
    if (!(ctx instanceof Context)) {
      throw new Error('A defineAction() action takes its ctx from the CMS, as the last argument')
    }
    return fn(ctx, ...(args.slice(0, -1) as Args))
  }
}

// Runs a server action as the CMS does, with `ctx` after its arguments. `action` is
// what React loads for the request: the action itself when the page's JavaScript
// calls it, or bound to its arguments for a form posted without JavaScript
// (React's decodeAction), where the ctx lands after them all the same.
export function invokeAction(
  // typed Function, as @vitejs/plugin-rsc and React give it
  action: Function,
  args: unknown[],
  ctx: Context,
): Promise<unknown> {
  return Reflect.apply(action, null, [...args, ctx]) as Promise<unknown>
}
