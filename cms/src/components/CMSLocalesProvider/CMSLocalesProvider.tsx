'use client'

import type { CMSLocalesConfig } from '../../framework/cms-config.ts'
import { invariant } from '../../utils/invariant.ts'
import { createContext, type FC, type PropsWithChildren, use } from 'react'

const context = createContext<CMSLocalesConfig | null>(null)

export const CMSLocalesProvider: FC<PropsWithChildren<{ locales: CMSLocalesConfig }>> = ({
  locales,
  children,
}) => {
  return <context.Provider value={locales}>{children}</context.Provider>
}

export const useCMSLocales = () =>
  use(context) ?? invariant('useCMSLocales must be used within a CMSLocalesProvider')
