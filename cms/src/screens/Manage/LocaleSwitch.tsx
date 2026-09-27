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
// it, grey where it's missing, and the one shown underlined, the line hanging out
// of the switch, so it's as tall as its text. A click anywhere on it, between the
// languages and a little around them too, goes no further, so a near miss doesn't
// reach a card or a field it sits in, and the pointer there isn't the card's.
export const LocaleSwitch: FC<LocaleSwitchProps> = ({ active, onChange, isFilled }) => {
  const { locales } = useCMSLocales()
  return (
    <div
      className="-m-1 flex cursor-default items-center gap-2 p-1"
      onClick={(e) => e.stopPropagation()}
    >
      {locales.map((locale) => (
        <button
          key={locale.code}
          type="button"
          aria-pressed={active === locale.code}
          onClick={() => onChange(locale.code)}
          className={`relative text-xs font-medium uppercase leading-4 transition-colors ${
            isFilled(locale.code) ? 'text-translated' : 'text-gray-400'
          }`}
        >
          {locale.code}
          {active === locale.code && (
            <span className="absolute inset-x-0 top-full h-0.5 rounded-full bg-current" />
          )}
        </button>
      ))}
    </div>
  )
}
