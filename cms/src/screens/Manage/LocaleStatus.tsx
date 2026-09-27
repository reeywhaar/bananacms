'use client'

import type { FC } from 'react'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import { useCMSLocales } from '#cms/components/CMSLocalesProvider/CMSLocalesProvider.tsx'

type LocaleStatusProps = {
  // the text in the default language
  text: string
  translationKey: string
  translations: Translations
}

// A translatable text's languages, small: green where it's there in that language,
// grey where it's missing.
export const LocaleStatus: FC<LocaleStatusProps> = ({ text, translationKey, translations }) => {
  const { locales, default: defaultLocale } = useCMSLocales()
  const isFilled = (code: string) =>
    code === defaultLocale ? !!text : !!translations[code]?.[translationKey]
  return (
    <span className="inline-flex gap-1 text-[10px] font-semibold uppercase leading-none tracking-wide">
      {locales.map((locale) => (
        <span
          key={locale.code}
          className={isFilled(locale.code) ? 'text-green-600' : 'text-gray-300'}
        >
          {locale.code}
        </span>
      ))}
    </span>
  )
}
