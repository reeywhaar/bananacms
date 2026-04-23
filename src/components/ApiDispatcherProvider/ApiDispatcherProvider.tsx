'use client'

import { ApiDispatcher } from '@cms/lib/api/Dispatcher'
import { invariant } from '@cms/utils/invariant'
import { createContext, FC, PropsWithChildren, use, useMemo } from 'react'

const context = createContext<ApiDispatcher | null>(null)

export const ApiDispatcherProvider: FC<PropsWithChildren<{ traceId?: string }>> = ({
  traceId,
  children,
}) => {
  const dispatcher = useMemo(() => new ApiDispatcher(traceId), [traceId])
  return <context.Provider value={dispatcher}>{children}</context.Provider>
}

export const useApiDispatcher = () =>
  use(context) ?? invariant('useAppDispatcher must be used within an AppDispatcherProvider')
