'use client'

import { useEffect, useRef, useState } from 'react'
import { Link } from '@app/i18n/navigation'
import { LangToggle } from '@app/components/LangToggle/LangToggle'
import { useDisposableEffect } from '@app/hooks/useDisposableEffect'
import { Menu, X } from '@deemlol/next-icons'
import { useSideMenu } from './SideMenuContext'

export default function SideMenu({
  sections,
  loggedIn,
}: {
  sections: { id: string; name: string; description: string; postCount: number; url: string }[]
  loggedIn: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const { isForceOpen } = useSideMenu()

  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)')
    setTimeout(() => {
      setIsDesktop(mql.matches)
    }, 100)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const isForcedVisible = isForceOpen && isDesktop

  useDisposableEffect(
    (stack) => {
      if (!isOpen) return
      closeButtonRef.current?.focus()
      document.addEventListener(
        'keydown',
        stack.adopt(
          (e) => {
            if (e.key === 'Escape') setIsOpen(false)
          },
          (h) => document.removeEventListener('keydown', h),
        ),
      )
    },
    [isOpen],
  )

  useEffect(() => {
    if (!isOpen || isForcedVisible) return
    document.body.classList.add('overflow-hidden')
    return () => {
      document.body.classList.remove('overflow-hidden')
    }
  }, [isOpen, isForcedVisible])

  return (
    <>
      {/* Burger button */}
      {!isForcedVisible && (
        <button
          aria-label="Open menu"
          aria-expanded={isOpen}
          className={`flex flex-col justify-center interactive cursor-pointer ${isOpen ? 'hidden' : 'block'}`}
          onClick={() => setIsOpen(true)}
        >
          <Menu size={20} fontWeight={600} />
        </button>
      )}

      {/* Backdrop */}
      {isOpen && !isForcedVisible && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-70 flex flex-col overflow-y-auto bg-white/97 transition-transform duration-300 ease-in-out ${isOpen || isForcedVisible ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal={!isForcedVisible}
        aria-label="Navigation menu"
      >
        {/* Close button */}
        <div className="flex justify-end px-1 py-0.5 min-h-9">
          {!isForcedVisible && (
            <button
              ref={closeButtonRef}
              aria-label="Close menu"
              className="w-8 h-8 flex items-center justify-center text-2xl leading-none interactive cursor-pointer"
              onClick={() => setIsOpen(false)}
            >
              <X size={20} fontWeight={600} />
            </button>
          )}
        </div>

        {/* Section links */}
        <nav className={`flex flex-col flex-1`}>
          {sections.map((s) => {
            const label = s.name
            if (!loggedIn && s.postCount === 0) return null
            return (
              <Link
                key={s.id}
                href={{ pathname: s.url }}
                className="interactive flex flex-col items-start justify-center px-4 py-2 border-b border-white/10 hover:bg-white/5 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <span className="font-light text-xl">
                  {label}
                  {!s.postCount ? <span className="text-xs opacity-40"> Empty</span> : ''}
                </span>
                {s.description && (
                  <span className="font-light text-xs opacity-40">{s.description}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {loggedIn ? (
          <div className="p-4">
            <Link
              href="/manage"
              className="interactive block w-full text-center px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Dashboard
            </Link>
          </div>
        ) : null}

        {/* Lang toggle */}
        <div className="p-4">
          <LangToggle />
        </div>
      </div>
    </>
  )
}
