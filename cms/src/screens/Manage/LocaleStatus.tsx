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
    <span className="inline-flex gap-0.5 text-[9px] font-medium uppercase leading-none">
      {locales.map((locale) => (
        <span
          key={locale.code}
          className={isFilled(locale.code) ? 'text-translated' : 'text-gray-300'}
        >
          {locale.code}
        </span>
      ))}
    </span>
  )
}
