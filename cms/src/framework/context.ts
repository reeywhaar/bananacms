import type { Db, DerivedDb } from '../lib/db/client.ts'
import type { Logger } from '../lib/logger/Logger.ts'
import { Cookies } from './cookies.ts'
import type { RedirectTarget } from './redirect.ts'
import type { Params } from './route-table.ts'

// What a piece of work was given, passed to it first and never stored: a bag of
// values by key. A child scope sets what it changes and reads the rest from its
// parent. The server's app context holds what lasts as long as it runs, each
// request's context is a child of it that the CMS's middleware fills in, a site's
// middleware can add values of its own, and pages, layouts and server actions get
// it (docs/context.md).
//
// The values live in private fields. React's development build copies server
// component props into the page for React DevTools, and it copies only an
// object's own fields, so a ctx arrives there empty.
export class Context {
  readonly #values = new Map<symbol, unknown>()
  readonly #parent: Context | undefined

  constructor(parent?: Context) {
    this.#parent = parent
  }

  // this scope's value for `key`, or else its parent's
  get(key: symbol): unknown {
    return this.#values.has(key) ? this.#values.get(key) : this.#parent?.get(key)
  }

  // answers with itself, so a scope reads as the patch it is: ctx.child().set(KEY, …)
  set(key: symbol, value: unknown): this {
    this.#values.set(key, value)
    return this
  }

  child(): Context {
    return new Context(this)
  }
}

// The value the context must have for `key`: a context missing it says so here,
// instead of something failing further on.
export function required<T>(ctx: Context, key: symbol): T {
  const value = ctx.get(key)
  if (value === undefined) throw new Error(`The context has no ${key.description}`)
  return value as T
}

// The CMS's values. The symbols stay in this module, so the functions below are
// the only way to them.
const REQUEST = Symbol('Request')
const REQUEST_URL = Symbol('URL')
const PARAMS = Symbol('Params')
const COOKIES = Symbol('Cookies')
const LOGGER = Symbol('Logger')
const DB = Symbol('Db')
const DERIVED_DB = Symbol('DerivedDb')
const AUTH = Symbol('Auth')
const RESPONSE = Symbol('Response')

// the signed-in CMS user, from the session cookie
export type Auth = {
  user: { id: string; name: string }
  token: string
  tokenExpiresAt: string
}

// What rendering decides about the response: whether the browser asked for an RSC
// payload (client-side navigation or a server action), and the status or redirect
// a page's notFound() or redirect() sets, for the HTML response when its headers
// are still to go out.
type ResponseState = { rsc: boolean; status?: number; redirect?: RedirectTarget }

// A request's context as the CMS starts it, a child of the app's. Its middleware
// adds the databases and the session.
export function createRequestContext(
  app: Context,
  init: { request: Request; url: URL; params: Params; logger: Logger; rsc: boolean },
): Context {
  return app
    .child()
    .set(REQUEST, init.request)
    .set(REQUEST_URL, init.url)
    .set(PARAMS, init.params)
    .set(COOKIES, new Cookies(init.request.headers.get('cookie')))
    .set(LOGGER, init.logger)
    .set(RESPONSE, { rsc: init.rsc } satisfies ResponseState)
}

export const getRequest = (ctx: Context): Request => required(ctx, REQUEST)

// the page's URL, without the _.rsc suffix of client navigation requests
export const getUrl = (ctx: Context): URL => required(ctx, REQUEST_URL)

// The matched route's params. `P` names their shape, as PageProps<P> does:
// getParams<{ id: string }>(ctx).id
export const getParams = <P extends Params = Params>(ctx: Context): P => required(ctx, PARAMS)

export const getCookies = (ctx: Context): Cookies => required(ctx, COOKIES)

// The app's logger has no label; a request's is labeled [Request], with the
// request's traceId, method and path.

export const getLogger = (ctx: Context): Logger => required(ctx, LOGGER)

export const setLogger = (ctx: Context, logger: Logger): Context => ctx.set(LOGGER, logger)

// A request's drizzle handles, which the CMS's middleware sets before the site's
// runs (databases.ts).

export const getDb = (ctx: Context): Db => required(ctx, DB)

export const getDerivedDb = (ctx: Context): DerivedDb => required(ctx, DERIVED_DB)

export const setDatabases = (ctx: Context, databases: { db: Db; derivedDb: DerivedDb }): Context =>
  ctx.set(DB, databases.db).set(DERIVED_DB, databases.derivedDb)

// the signed-in user, or undefined for visitors
export const getAuth = (ctx: Context): Auth | undefined => ctx.get(AUTH) as Auth | undefined

export const setAuth = (ctx: Context, auth: Auth | undefined): Context => ctx.set(AUTH, auth)

// The response state, for the framework's own use.

export const isRscRequest = (ctx: Context): boolean => required<ResponseState>(ctx, RESPONSE).rsc

export function setResponseStatus(ctx: Context, status: number): void {
  required<ResponseState>(ctx, RESPONSE).status = status
}

export const getResponseStatus = (ctx: Context): number | undefined =>
  required<ResponseState>(ctx, RESPONSE).status

export function setResponseRedirect(ctx: Context, target: RedirectTarget): void {
  required<ResponseState>(ctx, RESPONSE).redirect = target
}

export const getResponseRedirect = (ctx: Context): RedirectTarget | undefined =>
  required<ResponseState>(ctx, RESPONSE).redirect
