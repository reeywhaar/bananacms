'use client'

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
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
// so a form in it starts afresh each time, and only once it's shown, so what they
// measure as they mount, like an autosized field its height, isn't 0 from a closed
// dialog's display: none. While it's open, the page, and the
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
  // whether the dialog is open, which it is only after the render that opens it
  const [shown, setShown] = useState(false)

  useEffect(() => setHost(document.body), [])

  // Before paint, as is the render of the contents that follows, so the dialog
  // isn't drawn empty.
  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    // guarded both ways: showModal() throws on an open dialog, and close() on a
    // closed one fires another close event
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
    setShown(open)
  }, [open, host])

  // showModal() focuses the first control, whatever it is: a delete button looks
  // armed. A field marked data-autofocus gets it, or else the dialog.
  useLayoutEffect(() => {
    const dialog = ref.current
    if (!shown || !dialog) return
    const wants = dialog.querySelector('[data-autofocus]')
    if (wants instanceof HTMLElement) wants.focus()
    else dialog.focus()
  }, [shown])

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
      // hidden while closed, as open:flex would otherwise show it. On a phone it's
      // the whole screen, past the browser's max sizes for a modal, which keep it
      // 2em and more from the edges. Wider, m-auto centres it, which Tailwind's
      // reset of margins undoes, and h-fit keeps it to its contents rather than
      // stretching it between the top and bottom insets.
      className={`m-0 hidden h-dvh max-h-none w-full max-w-none flex-col overflow-hidden bg-white p-0 backdrop:bg-black/50 open:flex focus:outline-none sm:m-auto sm:h-fit sm:max-h-[85dvh] sm:rounded-lg sm:shadow-xl ${
        wide ? 'sm:w-[min(42rem,calc(100vw-2rem))]' : 'sm:w-[min(28rem,calc(100vw-2rem))]'
      }`}
    >
      {open && shown && (
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
          {/* On a phone, the space between the title and the buttons. Wider, as tall
              as what's in it, shrinking to scroll it once the dialog is as tall as it
              goes: not flex-1 there, as WebKit sizes a dialog that fits its contents by
              its rows' flex bases, and flex-1's is 0, which collapses the body. */}
          <div
            ref={bodyRef}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4 sm:flex-initial"
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
