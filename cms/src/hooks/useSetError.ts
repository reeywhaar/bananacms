import { useCallback, useState } from 'react'

export const useSetError = () => {
  const [error, setError] = useState<Error | null>(null)

  if (error) throw error

  return useCallback((e: unknown) => {
    if (e instanceof Error) {
      setError(e)
    } else {
      setError(new Error(String(e)))
    }
  }, [])
}
