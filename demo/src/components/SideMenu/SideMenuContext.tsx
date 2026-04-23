'use client'

import {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useState,
} from 'react'
import { invariant } from '@app/utils/invariant'

type SideMenuContextValue = {
  isForceOpen: boolean
  forceOpen: () => () => void
}

const SideMenuContext = createContext<SideMenuContextValue | null>(null)

export const SideMenuProvider: FC<PropsWithChildren> = ({ children }) => {
  const [forceOpenCount, setForceOpenCount] = useState(0)

  const forceOpen = useCallback(() => {
    setForceOpenCount((c) => c + 1)
    return () => setForceOpenCount((c) => c - 1)
  }, [])

  const value: SideMenuContextValue = {
    isForceOpen: forceOpenCount > 0,
    forceOpen,
  }

  return <SideMenuContext.Provider value={value}>{children}</SideMenuContext.Provider>
}

export const useSideMenu = () => {
  return useContext(SideMenuContext) ?? invariant('SideMenuContext is not provided')
}
