'use client'

import { useEffect } from 'react'
import { useSideMenu } from './SideMenuContext'

export default function SideMenuForceOpen({ delay }: { delay?: number } = {}) {
  const { forceOpen } = useSideMenu()

  useEffect(() => {
    let unset: (() => void) | null = null
    const timeout = setTimeout(() => {
      unset = forceOpen()
    }, delay ?? 0)
    return () => {
      clearTimeout(timeout)
      unset?.()
    }
  }, [forceOpen, delay])

  return null
}
