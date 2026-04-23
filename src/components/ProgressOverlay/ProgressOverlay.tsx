'use client'

import { invariant } from '@cms/utils/invariant'
import {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react'
import { flushSync } from 'react-dom'
import { useDisposableEffect } from '@cms/hooks/useDisposableEffect'

export type WithProgress = (fn: () => Promise<void>) => Promise<void>

const ProgressOverlayContext = createContext<WithProgress | null>(null)

export const ProgressOverlayProvider: FC<PropsWithChildren> = ({ children }) => {
  const [count, setCount] = useState(0)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const withProgress: WithProgress = useCallback(async (fn) => {
    flushSync(() => setCount((c) => c + 1))
    try {
      await fn()
    } finally {
      setCount((c) => c - 1)
    }
  }, [])

  const isPending = count > 0

  useDisposableEffect(
    (stack) => {
      const dialog = dialogRef.current
      if (!dialog) return
      if (isPending) {
        if (dialog.open) return
        stack.adopt(
          setTimeout(() => dialog.showModal(), 300),
          clearTimeout,
        )
        return
      }
      if (dialog.open) dialog.close()
    },
    [isPending],
  )

  return (
    <ProgressOverlayContext.Provider value={withProgress}>
      {children}
      <dialog
        ref={dialogRef}
        onCancel={(e) => e.preventDefault()}
        className="fixed inset-0 m-0 p-0 w-screen h-screen max-w-none max-h-none border-0 bg-transparent backdrop:bg-white/60"
      >
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-blue-500 animate-spin" />
        </div>
      </dialog>
    </ProgressOverlayContext.Provider>
  )
}

export const useWithProgress = (): WithProgress =>
  useContext(ProgressOverlayContext) ?? invariant('ProgressOverlayContext is not provided')
