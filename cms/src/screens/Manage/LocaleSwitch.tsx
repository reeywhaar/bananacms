'use client'

import type { FC } from 'react'
import { useCMSLocales } from '#cms/components/CMSLocalesProvider/CMSLocalesProvider.tsx'

type LocaleSwitchProps = {
  active: string
  onChange: (locale: string) => void
  // whether the text in that language is there, which shows it green
  isFilled: (locale: string) => boolean
}

// The site's languages, to pick one to show: each green where the text is there in
// it, grey where it's missing, and the one shown with a dot under it, which hangs
// out of the switch, so it's as tall as its line. A click on it goes no further, so
// it doesn't reach a card or a field it sits in.
export const LocaleSwitch: FC<LocaleSwitchProps> = ({ active, onChange, isFilled }) => {
  const { locales } = useCMSLocales()
  return (
    <div className="flex items-center gap-2">
      {locales.map((locale) => (
        <button
          key={locale.code}
          type="button"
          aria-pressed={active === locale.code}
          onClick={(e) => {
            e.stopPropagation()
            onChange(locale.code)
          }}
          className={`relative text-xs font-medium uppercase leading-4 transition-colors ${
            isFilled(locale.code) ? 'text-translated' : 'text-gray-400'
          }`}
        >
          {locale.code}
          {active === locale.code && (
            <span className="absolute left-1/2 top-full size-1 -translate-x-1/2 rounded-full bg-current" />
          )}
        </button>
      ))}
    </div>
  )
}
