'use client'

import { invariant } from '#cms/utils/invariant.ts'
import { Link } from '#cms/framework/link.tsx'
import {
  createContext,
  type FC,
  Fragment,
  type PropsWithChildren,
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

// The page's breadcrumbs, under Main in the admin bar: each a link but the last,
// with a dash between them
export const Breadcrumbs: FC<{ className?: string }> = ({ className }) => {
  const { items } = useBreadcrumbsContext()
  if (items.length === 0) return null

  return (
    <div className={['flex flex-row flex-wrap items-center gap-2', className].join(' ')}>
      {items.map((b, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-sm font-light opacity-50">-</span>}
          {b.url ? (
            <Link href={b.url} className="interactive text-sm font-light">
              {b.name}
            </Link>
          ) : (
            <span className="text-sm font-light opacity-50">{b.name}</span>
          )}
        </Fragment>
      ))}
    </div>
  )
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
