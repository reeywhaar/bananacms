import 'server-only'
import { defineAction } from '../framework/actions.ts'
import { getLogger, type Context } from '../framework/context.ts'
import { ApiError } from './api/error.ts'
import { requireAuth } from './auth.ts'
import { errorFields } from './logger/Logger.ts'
import { createServerAction } from './serverActions.ts'

// A server action for the admin, called with the request's ctx before its own
// arguments. It fails for visitors who aren't signed in, and returns its result or
// error as data (createServerAction), which the admin's client code unwraps with
// handleServerResult. The browser gets "Internal server error" for any error but
// an exposed ApiError, so those are logged here.
export const adminAction = <TArgs extends unknown[], TResult>(
  cb: (ctx: Context, ...args: TArgs) => Promise<TResult>,
) =>
  defineAction(
    createServerAction(async (ctx: Context, ...args: TArgs): Promise<TResult> => {
      requireAuth(ctx)
      try {
        return await cb(ctx, ...args)
      } catch (error) {
        if (!(error instanceof ApiError && error.exposed)) {
          getLogger(ctx).child('Action').error('failed', errorFields(error))
        }
        throw error
      }
    }),
  )
