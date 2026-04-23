import 'disposablestack/auto'
import { DependencyList, useEffect, useLayoutEffect, useRef } from 'react'

export const useDisposableEffect = (
  eff: (stack: DisposableStack, initial: boolean) => void | undefined,
  deps: DependencyList,
) => {
  const firstRun = useRef(true)

  useEffect(() => {
    const initial = firstRun.current
    if (firstRun.current) {
      firstRun.current = false
    }
    const stack = new DisposableStack()
    try {
      eff(stack, initial)
    } catch (e) {
      stack.dispose()
      throw e
    }
    return () => {
      if (!stack.disposed) stack.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export const useDisposableLayoutEffect = (
  eff: (stack: DisposableStack, initial: boolean) => void | undefined,
  deps: DependencyList,
) => {
  const firstRun = useRef(true)

  useLayoutEffect(() => {
    const initial = firstRun.current
    if (firstRun.current) {
      firstRun.current = false
    }
    const stack = new DisposableStack()
    try {
      eff(stack, initial)
    } catch (e) {
      stack.dispose()
      throw e
    }
    return () => {
      if (!stack.disposed) stack.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
