export type CookieOptions = { maxAge: number }

// The request's cookies, including the ones set while handling it. Setting one
// queues a Set-Cookie header, which reaches the browser when it's set before the
// response headers go out: in middleware and in server actions.
export class Cookies {
  readonly #values: Map<string, string>
  readonly #setCookieHeaders: string[] = []

  constructor(header: string | null) {
    this.#values = parseCookies(header)
  }

  get(name: string): string | undefined {
    return this.#values.get(name)
  }

  set(name: string, value: string, options: CookieOptions): void {
    this.#values.set(name, value)
    this.#setCookieHeaders.push(serializeCookie(name, value, options.maxAge))
  }

  delete(name: string): void {
    this.#values.delete(name)
    this.#setCookieHeaders.push(serializeCookie(name, '', 0))
  }

  // the queued headers, in the order the cookies were set
  get setCookieHeaders(): readonly string[] {
    return this.#setCookieHeaders
  }
}

function serializeCookie(name: string, value: string, maxAge: number): string {
  const attributes = [`Path=/`, `Max-Age=${maxAge}`, 'HttpOnly', 'SameSite=Lax']
  if (import.meta.env.PROD) attributes.push('Secure')
  return [`${name}=${encodeURIComponent(value)}`, ...attributes].join('; ')
}

function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>()
  for (const pair of header?.split(';') ?? []) {
    const index = pair.indexOf('=')
    if (index === -1) continue
    try {
      cookies.set(pair.slice(0, index).trim(), decodeURIComponent(pair.slice(index + 1).trim()))
    } catch {
      // skip malformed values
    }
  }
  return cookies
}
