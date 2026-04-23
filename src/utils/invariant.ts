export const invariant = (err: string | Error) => {
  throw err instanceof Error ? err : new Error(String(err))
}
