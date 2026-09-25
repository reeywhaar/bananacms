'use client'

import { useCallback, useEffect, useRef } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useEvent = <F extends (...args: any[]) => any>(handler: F) => {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  return useCallback((...args: Parameters<F>) => {
    return handlerRef.current(...args)
  }, [])
}
