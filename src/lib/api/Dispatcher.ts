import { v4 as uuid } from 'uuid'

export type ApiActionDescriptor = {
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: string
}

export type ApiAction<R> = (dispatch: (action: ApiActionDescriptor) => Promise<R>) => Promise<R>

export class RequestError extends Error {
  constructor(public readonly cause: unknown) {
    super('Network request failed')
    this.name = 'RequestError'
  }
}

export class ServerError extends Error {
  public response!: string
  private constructor(status: number) {
    super(`Server failed with status ${status}`)
    this.name = 'ServerError'
  }

  static create(status: number, response: string): ServerError {
    const error = new ServerError(status)
    error.response = response
    return error
  }
}

export class ApiError extends Error {
  public response!: { error: string }
  private constructor(status: number, error: string) {
    super(`API failed with ${status}: ${error}`)
    this.name = 'ApiError'
  }

  static create(status: number, response: { error: string }): ApiError {
    const error = new ApiError(status, response.error)
    error.response = response
    return error
  }
}

export class ApiDispatcher {
  constructor(private readonly traceId?: string) {}

  async dispatch<R>(action: ApiAction<R>): Promise<R> {
    return action((descriptor) => this.dispatchAction<R>(descriptor))
  }

  private async dispatchAction<R>(action: ApiActionDescriptor): Promise<R> {
    const headers: Record<string, string> = { 'x-trace-id': this.traceId ?? uuid() }
    if (typeof action.body === 'string') {
      headers['Content-Type'] = 'application/json'
    }
    let res: Response
    try {
      res = await fetch(action.endpoint, {
        method: action.method,
        headers,
        body: action.body,
      })
    } catch (cause) {
      throw new RequestError(cause)
    }
    if (!res.ok) {
      if (res.status >= 500) {
        const text = await res.text()
        throw ServerError.create(res.status, text)
      } else {
        const json = await res.json().catch(() => null)
        if (json && typeof json.error === 'string') {
          throw ApiError.create(res.status, { error: json.error })
        } else {
          throw ApiError.create(res.status, { error: 'Unknown error' })
        }
      }
    }
    const contentType = res.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      return res.json() as Promise<R>
    }
    return undefined as R
  }
}

export function createAction<R>(action: ApiAction<R>): ApiAction<R> {
  return action
}

export const dispatcher = new ApiDispatcher()
