'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigationPending } from '../../framework/navigation.ts'

const PHASES: Record<'idle' | 'loading' | 'done', CSSProperties> = {
  idle: { transform: 'scaleX(0)', opacity: 0, transition: 'none' },
  loading: {
    transform: 'scaleX(0.9)',
    opacity: 1,
    transition: 'transform 10s cubic-bezier(0.1, 0.8, 0.2, 1), opacity 0.1s',
  },
  done: {
    transform: 'scaleX(1)',
    opacity: 0,
    transition: 'transform 0.2s ease-out, opacity 0.3s 0.2s',
  },
}

// A bar across the top of the page while a navigation or an action's re-render is
// in flight, as nextjs-toploader draws it: it grows while the server works, then
// fills the width and fades.
export function TopLoader({ color }: { color: string }) {
  const pending = useNavigationPending()
  const [phase, setPhase] = useState<keyof typeof PHASES>('idle')

  useEffect(() => {
    if (pending) setPhase('loading')
    else setPhase((current) => (current === 'loading' ? 'done' : current))
  }, [pending])

  useEffect(() => {
    if (phase !== 'done') return
    const timer = setTimeout(() => setPhase('idle'), 500)
    return () => clearTimeout(timer)
  }, [phase])

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 1600,
        pointerEvents: 'none',
        transformOrigin: 'left',
        background: color,
        boxShadow: `0 0 10px ${color}, 0 0 5px ${color}`,
        ...PHASES[phase],
      }}
    />
  )
}
