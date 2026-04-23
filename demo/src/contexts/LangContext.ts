'use client'

import { langConfig } from '@app/lib/langconfig'
import { invariant } from '@app/utils/invariant'
import { createContext, useContext } from 'react'

export type LangContextValue = typeof langConfig & { currentLocale: string }
const LangContext = createContext<LangContextValue | null>(null)
export const LangContextProvider = LangContext.Provider

export const useLangContext = () =>
  useContext(LangContext) ?? invariant('LangContext must be provided')
