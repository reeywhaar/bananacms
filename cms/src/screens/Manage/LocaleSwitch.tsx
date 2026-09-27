'use client'

import type { FC } from 'react'
import { useCMSLocales } from '#cms/components/CMSLocalesProvider/CMSLocalesProvider.tsx'

type LocaleSwitchProps = {
  active: string
  onChange: (locale: string) => void
  // whether the text in that language is there, which a green dot shows
  isFilled: (locale: string) => boolean
}

// The site's languages, to pick one to show. A click on it goes no further, so
// it doesn't reach a card or a field it sits in.
export const LocaleSwitch: FC<LocaleSwitchProps> = ({ active, onChange, isFilled }) => {
  const { locales } = useCMSLocales()
  return (
    <div className="flex items-center gap-1">
      {locales.map((locale) => (
        <button
          key={locale.code}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onChange(locale.code)
          }}
          className={[
            'text-xs uppercase transition-colors flex items-center gap-0.5',
            active === locale.code ? 'font-semibold' : 'font-normal',
          ].join(' ')}
        >
          <span
            className={[
              'text-2xl transition-colors',
              isFilled(locale.code) ? 'text-green-600' : 'text-gray-300',
            ].join(' ')}
          >
            •
          </span>
          {locale.code}
        </button>
      ))}
    </div>
  )
}
