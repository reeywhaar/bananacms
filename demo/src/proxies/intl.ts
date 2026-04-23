import createMiddleware from 'next-intl/middleware'
import { routing } from '@app/i18n/routing'
import { adaptNextProxy } from '@reeywhaar/bananacms/runtime'

export const intlProxy = adaptNextProxy(createMiddleware(routing))
