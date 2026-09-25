import { getRequest, type Middleware } from '@reeywhaar/bananacms'
import { preferredLocale, setPreferredLocale } from './lib/locale.ts'

export default [
  async (ctx, next) => {
    setPreferredLocale(ctx, preferredLocale(getRequest(ctx).headers.get('accept-language')))
    return next()
  },
] satisfies Middleware[]
