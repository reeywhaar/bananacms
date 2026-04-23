'use client'

import { Link } from '@app/i18n/navigation'
import { invariant } from '@app/utils/invariant'
import { useTranslations } from 'next-intl'
import {
  createContext,
  FC,
  PropsWithChildren,
  Ref,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

type Breadcrumb = {
  name: string
  url?: string
  ref?: Ref<HTMLElement>
}

const BreadcrumbsContext = createContext<{
  items: Breadcrumb[]
  setItems: (items: Breadcrumb[]) => void
} | null>(null)

export const BreadcrumbsProvider: FC<PropsWithChildren> = ({ children }) => {
  const [items, setItems] = useState<Breadcrumb[]>([])

  const ctx = { items, setItems }

  return <BreadcrumbsContext.Provider value={ctx}>{children}</BreadcrumbsContext.Provider>
}

const useBreadcrumbsContext = () => {
  return useContext(BreadcrumbsContext) ?? invariant('BreadcrumbsContext is not provided')
}

export const Breadcrumbs: FC = () => {
  const t = useTranslations('main')
  const { items } = useBreadcrumbsContext()
  const mainItemVisible = items.length > 0
  const [scrolledEnough, setScrolledEnough] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolledEnough(window.scrollY > 50)
    }

    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const renderBreadcrumb = useCallback(
    (b: Breadcrumb, index: number) => {
      return b.url ? (
        <Link
          key={b.url}
          href={b.url}
          ref={b.ref as Ref<HTMLAnchorElement>}
          style={index === 0 ? { opacity: mainItemVisible || scrolledEnough ? 1 : 0 } : undefined}
          className="interactive text-sm font-light transition-opacity"
        >
          {b.name}
        </Link>
      ) : (
        <span key={b.name} ref={b.ref} className="text-sm font-light opacity-50">
          {b.name}
        </span>
      )
    },
    [mainItemVisible, scrolledEnough],
  )

  const elements = useMemo(() => {
    return [{ name: t('name'), url: '/' }, ...items].map(renderBreadcrumb).reduce(
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
  }, [items, renderBreadcrumb, t])

  return <div className="flex flex-row items-center gap-2">{elements}</div>
}

export const WithBreadcrumbs: FC<PropsWithChildren<{ items: Breadcrumb[] }>> = ({
  children,
  items,
}) => {
  const { setItems } = useBreadcrumbsContext()

  useEffect(() => {
    setItems(items)

    return () => setItems([])
  }, [items, setItems])

  return children
}
