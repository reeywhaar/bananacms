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
  // false: the field has its one text, and no switch between languages. The field
  // it renders stays the same either way, so switching this keeps it mounted.
  localizable?: boolean
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
  localizable = true,
}) => {
  const { locales: allLocales, default: defaultLocale } = useCMSLocales()
  const [activeLocale, setActiveLocale] = useState<string>(defaultLocale)

  const setTranslation = (locale: string, text: string) => {
    onTranslationsChange({
      ...translations,
      [locale]: { ...translations[locale], [translationKey]: text },
    })
  }

  const shownLocale = localizable ? activeLocale : defaultLocale

  const activeValue =
    shownLocale === defaultLocale ? value : (translations[shownLocale]?.[translationKey] ?? '')

  const activeOnChange =
    shownLocale === defaultLocale ? onChange : (text: string) => setTranslation(shownLocale, text)

  const isFilled = (locale: string) =>
    locale === defaultLocale ? !!value : !!translations[locale]?.[translationKey]

  return (
    <div className={['relative', className].filter(Boolean).join(' ')}>
      {localizable && allLocales.length > 1 && (
        <div className="absolute right-2 top-0.5">
          <LocaleSwitch active={activeLocale} onChange={setActiveLocale} isFilled={isFilled} />
        </div>
      )}
      {render(activeValue, activeOnChange, label, value)}
    </div>
  )
}
