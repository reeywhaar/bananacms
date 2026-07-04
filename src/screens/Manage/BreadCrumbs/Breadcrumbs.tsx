'use client'

import { invariant } from '@cms/utils/invariant'
import Link from 'next/link'
import {
  createContext,
  FC,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

type Breadcrumb = {
  name: string
  url?: string
}

const BreadcrumbsContext = createContext<{
  items: Breadcrumb[]
  setItems: (items: Breadcrumb[]) => void
} | null>(null)

export const BreadcrumbsProvider: FC<PropsWithChildren> = ({ children }) => {
  const [items, setItems] = useState<Breadcrumb[]>([])

  const ctx = useMemo(() => ({ items, setItems }), [items, setItems])

  return <BreadcrumbsContext.Provider value={ctx}>{children}</BreadcrumbsContext.Provider>
}

const useBreadcrumbsContext = () => {
  return useContext(BreadcrumbsContext) ?? invariant('BreadcrumbsContext is not provided')
}

export const Breadcrumbs: FC = () => {
  const { items } = useBreadcrumbsContext()

  const renderBreadcrumb = (b: Breadcrumb) => {
    return b.url ? (
      <Link key={b.url} href={b.url} className="interactive text-sm font-light">
        {b.name}
      </Link>
    ) : (
      <span key={b.name} className="text-sm font-light opacity-50">
        {b.name}
      </span>
    )
  }

  const elements = useMemo(() => {
    return [{ name: 'Main', url: '/' }, ...items].map(renderBreadcrumb).reduce(
      (prev, curr) =>
        prev.length === 0
          ? [curr]
          : [
              ...prev,
              <span key={prev.length} className="text-sm font-light opacity-50">
                -
              </span>,
              curr,
            ],
      [] as React.ReactNode[],
    )
  }, [items])

  return <div className="flex flex-row flex-wrap items-center gap-2">{elements}</div>
}

export const WithBreadcrumbs: FC<PropsWithChildren<{ items: Breadcrumb[] }>> = ({
  children,
  items,
}) => {
  const { setItems } = useBreadcrumbsContext()

  // Key the effect on the items' value: server components pass a fresh array
  // on every RSC render, so an identity dep would re-fire per router.refresh().
  const itemsKey = JSON.stringify(items)
  const stableItems = useMemo(() => JSON.parse(itemsKey) as Breadcrumb[], [itemsKey])

  useEffect(() => {
    setItems(stableItems)

    return () => setItems([])
  }, [stableItems, setItems])

  return children
}
