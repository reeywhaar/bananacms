'use client'

import { type FC, type ReactNode, useState } from 'react'
import { useCMSLocales } from '#cms/components/CMSLocalesProvider/CMSLocalesProvider.tsx'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import { LocaleSwitch } from './LocaleSwitch.tsx'

type LocalizableFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  translationKey: string
  translations: Translations
  onTranslationsChange: (translations: Translations) => void
  render: (
    value: string,
    onChange: (value: string) => void,
    label: string,
    placeholder: string,
  ) => ReactNode
  className?: string
}

export const LocalizableField: FC<LocalizableFieldProps> = ({
  label,
  value,
  onChange,
  translationKey,
  translations,
  onTranslationsChange,
  render,
  className,
}) => {
  const { locales: allLocales, default: defaultLocale } = useCMSLocales()
  const [activeLocale, setActiveLocale] = useState<string>(defaultLocale)

  const setTranslation = (locale: string, text: string) => {
    onTranslationsChange({
      ...translations,
      [locale]: { ...translations[locale], [translationKey]: text },
    })
  }

  const activeValue =
    activeLocale === defaultLocale ? value : (translations[activeLocale]?.[translationKey] ?? '')

  const activeOnChange =
    activeLocale === defaultLocale ? onChange : (text: string) => setTranslation(activeLocale, text)

  const isFilled = (locale: string) =>
    locale === defaultLocale ? !!value : !!translations[locale]?.[translationKey]

  return (
    <div className={['relative', className].filter(Boolean).join(' ')}>
      {allLocales.length > 1 && (
        <div className="absolute right-2 top-[-2px]">
          <LocaleSwitch active={activeLocale} onChange={setActiveLocale} isFilled={isFilled} />
        </div>
      )}
      {render(activeValue, activeOnChange, label, value)}
    </div>
  )
}
