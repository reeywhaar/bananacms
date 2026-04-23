'use client'

import { useLangContext } from '@app/contexts/LangContext'
import { Link, usePathname } from '@app/i18n/navigation'
import { useLocale } from 'next-intl'
import { FC } from 'react'

export const LangToggle: FC = () => {
  const { locales } = useLangContext()
  const locale = useLocale()
  const path = usePathname()

  const nextLocale = locales[(locales.findIndex((l) => l.code === locale) + 1) % locales.length]

  return (
    <Link
      className="text-xs font-light interactive"
      href={{ pathname: path }}
      locale={nextLocale.code}
      replace={true}
      scroll={false}
    >
      {nextLocale.code.toUpperCase()}
    </Link>
  )
}
