'use client'

import { type FC, useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from '../icons.tsx'

export type MenuItem = {
  label: string
  onSelect: () => void
  // destructive, like Delete, which shows in the danger color
  danger?: boolean
}

// A "⋯" button that opens its actions in a list under it. A click outside it, or
// Escape, closes the list, and so does picking an action.
export const Menu: FC<{ items: MenuItem[]; label?: string }> = ({ items, label = 'More' }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center rounded px-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <MoreHorizontal size={18} strokeWidth={2} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-10 mt-1 flex min-w-32 flex-col rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className={`px-3 py-1.5 text-left text-sm hover:bg-gray-100 ${item.danger ? 'text-danger' : 'text-gray-700'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
