'use client'

import type { CMSLocalesConfig } from '@cms/config'
import { invariant } from '@cms/utils/invariant'
import { createContext, FC, PropsWithChildren, use } from 'react'

const context = createContext<CMSLocalesConfig | null>(null)

export const CMSLocalesProvider: FC<PropsWithChildren<{ locales: CMSLocalesConfig }>> = ({
  locales,
  children,
}) => {
  return <context.Provider value={locales}>{children}</context.Provider>
}

export const useCMSLocales = () =>
  use(context) ?? invariant('useCMSLocales must be used within a CMSLocalesProvider')
