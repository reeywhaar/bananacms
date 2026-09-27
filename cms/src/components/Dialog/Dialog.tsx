'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type FC,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from '../icons.tsx'
import { lockScroll } from './lockScroll.ts'

// The scrolling body of the dialog a part of the tree is in, if it's in one. A
// ref, since the element exists only once the dialog has rendered.
const DialogBodyContext = createContext<RefObject<HTMLDivElement | null> | null>(null)

type DialogProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  // buttons, under the body, which scrolls while they stay
  footer?: ReactNode
  wide?: boolean
}

// A modal on the native <dialog>, whose showModal() brings focus trapping, Escape
// and the top layer. It's controlled, and its contents mount only while it's open,
// so a form in it starts afresh each time. While it's open, the page, and the
// dialog it was opened from, don't scroll, and a press on the backdrop closes it.
//
// It's rendered into <body>, out of any form around the component that opens it,
// like an entity's: its buttons would submit that form, and so would Enter in its
// fields. React still bubbles its events to that component, so a clickable
// element renders the dialog it opens beside it rather than inside it.
export const Dialog: FC<DialogProps> = ({ open, onClose, title, children, footer, wide }) => {
  const ref = useRef<HTMLDialogElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const parentBody = useContext(DialogBodyContext)
  // A click that started inside and ended on the backdrop, like selecting text
  // past the edge, targets the dialog too, so only a press there closes it.
  const pressedBackdrop = useRef(false)
  const [host, setHost] = useState<HTMLElement | null>(null)

  useEffect(() => setHost(document.body), [])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    // guarded both ways: showModal() throws on an open dialog, and close() on a
    // closed one fires another close event
    if (open && !dialog.open) {
      dialog.showModal()
      // showModal() focuses the first control, whatever it is: a delete button
      // looks armed. A field marked data-autofocus gets it, or else the dialog.
      const wants = dialog.querySelector('[data-autofocus]')
      if (wants instanceof HTMLElement) wants.focus()
      else dialog.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, host])

  useEffect(() => {
    if (!open) return
    const releasePage = lockScroll(document.body)
    const parent = parentBody?.current
    const releaseParent = parent ? lockScroll(parent) : undefined
    return () => {
      releaseParent?.()
      releasePage()
    }
  }, [open, parentBody])

  if (!host) return null
  return createPortal(
    <dialog
      ref={ref}
      tabIndex={-1}
      // React hands a nested dialog's close and cancel to this one's handlers too
      onClose={(e) => {
        if (e.target === ref.current) onClose()
      }}
      // Escape: cancel comes before close, and both go through onClose
      onCancel={(e) => {
        if (e.target !== ref.current) return
        e.preventDefault()
        onClose()
      }}
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) onClose()
        pressedBackdrop.current = false
      }}
      // hidden while closed, as open:flex would otherwise show it. m-auto centres
      // it, which Tailwind's reset of margins undoes, and h-fit keeps it to its
      // contents rather than stretching it between the top and bottom insets. On a
      // phone, it's 5px from the screen's edges, past the browser's max-width for
      // a modal, which keeps it 2em and more from them.
      className={`m-auto hidden h-fit max-h-[85dvh] max-w-none flex-col overflow-hidden rounded-lg bg-white p-0 shadow-xl backdrop:bg-black/50 open:flex focus:outline-none ${
        wide ? 'w-[min(42rem,calc(100vw-10px))]' : 'w-[min(28rem,calc(100vw-10px))]'
      }`}
    >
      {open && (
        <DialogBodyContext.Provider value={bodyRef}>
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-2">
            <h2 className="truncate text-sm font-semibold text-gray-700">{title}</h2>
            <button
              type="button"
              aria-label="Close"
              title="Close"
              onClick={onClose}
              className="-mr-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
          <div
            ref={bodyRef}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4"
          >
            {children}
          </div>
          {footer && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
              {footer}
            </div>
          )}
        </DialogBodyContext.Provider>
      )}
    </dialog>,
    host,
  )
}
