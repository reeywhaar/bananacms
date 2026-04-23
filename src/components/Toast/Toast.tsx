'use client'

import { invariant } from '@cms/utils/invariant'
import { AlertTriangle, Info, XCircle } from '@deemlol/next-icons'
import {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react'

export type ToastLevel = 'info' | 'warn' | 'error'

export type ToastOptions = {
  onClick?: () => void
  timeout?: number
}

export type ShowToast = (level: ToastLevel, message: string, options?: ToastOptions) => () => void

type ToastItem = {
  id: string
  level: ToastLevel
  message: string
  onClick?: () => void
}

const ToastContext = createContext<ShowToast | null>(null)

export const ToastProvider: FC<PropsWithChildren> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const remove = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast: ShowToast = useCallback(
    (level, message, options) => {
      const id = generateId()
      const item: ToastItem = { id, level, message, onClick: options?.onClick }
      setToasts((prev) => [...prev, item])

      if (options?.timeout !== undefined) {
        const timer = setTimeout(() => remove(id), options.timeout)
        timers.current.set(id, timer)
      }

      return () => remove(id)
    },
    [remove],
  )

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-60 flex flex-col gap-2 items-end">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm w-full cursor-default ${levelClasses[toast.level]}`}
              onClick={toast.onClick}
              role="alert"
            >
              <span className="shrink-0 mt-0.5 opacity-75">{levelIcon[toast.level]}</span>
              <span className="flex-1">{toast.message}</span>
              <button
                className="ml-2 shrink-0 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  remove(toast.id)
                }}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export const useToast = (): ShowToast =>
  useContext(ToastContext) ?? invariant('ToastContext is not provided')

const levelClasses: Record<ToastLevel, string> = {
  info: 'bg-blue-50 border border-blue-200 text-blue-900',
  warn: 'bg-amber-50 border border-amber-200 text-amber-900',
  error: 'bg-red-50 border border-red-200 text-red-900',
}

const levelIcon: Record<ToastLevel, React.ReactNode> = {
  info: <Info size={16} strokeWidth={2.5} />,
  warn: <AlertTriangle size={16} strokeWidth={2.5} />,
  error: <XCircle size={16} strokeWidth={2.5} />,
}

const generateId = (): string => Math.random().toString(36).slice(2) + Date.now().toString(36)
