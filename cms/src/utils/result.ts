export type ResultOk<T> = {
  error: false
  value: T
}

export type ResultErr = {
  error: true
  value: unknown
}

export type Result<T> = ResultOk<T> | ResultErr

export function resultOk<T>(value: T): ResultOk<T> {
  return { error: false, value }
}

export function resultErr(value: unknown): ResultErr {
  return { error: true, value }
}

export function intoResult<T>(cb: () => Promise<T>): Promise<Result<T>>
export function intoResult<T>(cb: () => T): Result<T>
export function intoResult<T>(cb: () => T): unknown {
  try {
    const res = resultOk(cb())
    if (res.value instanceof Promise) {
      return res.value.then(resultOk).catch(resultErr)
    }
    return res
  } catch (e) {
    return resultErr(e)
  }
}
