import { ApiError } from './api/error'

type ServerResult<T> = { error: false; data: T } | { error: true; status: number; data: string }

export const createServerAction = <TArgs extends unknown[], TResult>(
  cb: (...args: TArgs) => Promise<TResult>,
) => {
  return async (...args: TArgs): Promise<ServerResult<TResult>> => {
    try {
      const res = await cb(...args)
      return { error: false, data: res }
    } catch (e) {
      if (e instanceof ApiError) {
        return {
          error: true,
          status: e.status,
          data: e.exposed ? e.message : 'Internal server error',
        }
      }
      return { error: true, status: 500, data: 'Internal server error' }
    }
  }
}

export const handleServerResult = <A>(res: ServerResult<A>) => {
  if (res.error) {
    throw new ApiError(res.data).withStatus(res.status)
  }
  return res.data
}
