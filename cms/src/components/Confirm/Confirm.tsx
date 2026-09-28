'use client'

import {
  createContext,
  type FC,
  type PropsWithChildren,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react'
import { invariant } from '#cms/utils/invariant.ts'
import { Dialog } from '../Dialog/Dialog.tsx'

export type ConfirmOptions = {
  // the question, like “Delete this page?”
  title: string
  // what follows from going ahead, like that it can't be undone
  message: string
  // the button that goes ahead, named for what it does, like Delete
  action: string
  // destructive: that button in the danger color, and Cancel focused, so Enter
  // doesn't do it
  danger?: boolean
}

// whether to go ahead
export type Confirm = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<Confirm | null>(null)

// Asks before an action, as the browser's confirm() does, in a dialog like the
// admin's others, laid out as a macOS alert has it: the question, what follows
// from it, and Cancel beside a button named for the action. Closing the dialog,
// any way, is Cancel. A button that asks says so with an ellipsis, like
// “Delete…”.
export const ConfirmProvider: FC<PropsWithChildren> = ({ children }) => {
  const [asking, setAsking] = useState<ConfirmOptions | null>(null)
  const resolveAsking = useRef<((ok: boolean) => void) | null>(null)

  // another question while one is open cancels that one
  const confirm: Confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolveAsking.current?.(false)
        resolveAsking.current = resolve
        setAsking(options)
      }),
    [],
  )

  const answer = (ok: boolean) => {
    resolveAsking.current?.(ok)
    resolveAsking.current = null
    setAsking(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={asking !== null}
        onClose={() => answer(false)}
        title={asking?.title ?? ''}
        footer={
          <>
            <button
              type="button"
              className="button"
              data-autofocus={asking?.danger ? '' : undefined}
              onClick={() => answer(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={asking?.danger ? 'button-danger' : 'button'}
              data-autofocus={asking?.danger ? undefined : ''}
              onClick={() => answer(true)}
            >
              {asking?.action}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-700">{asking?.message}</p>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export const useConfirm = (): Confirm =>
  useContext(ConfirmContext) ?? invariant('ConfirmContext is not provided')
