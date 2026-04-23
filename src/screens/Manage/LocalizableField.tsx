'use client'

import { FC, ReactNode, useState } from 'react'
import { useCMSLocales } from '@cms/components/CMSLocalesProvider/CMSLocalesProvider'
import { Translations } from '@cms/services/LocalizationStore'

type LocalizableFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  translationKey: string
  translations: Translations
  onTranslationsChange: (translations: Translations) => void
  render: (value: string, onChange: (value: string) => void, label: string, placeholder: string) => ReactNode
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
        <div className="absolute right-0 top-0 flex items-center gap-1">
          {allLocales.map((locale) => (
            <button
              key={locale.code}
              type="button"
              onClick={() => setActiveLocale(locale.code)}
              className={[
                'text-xs uppercase transition-colors flex items-center gap-0.5',
                activeLocale === locale.code ? 'font-semibold' : 'font-normal',
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
      )}
      {render(activeValue, activeOnChange, label, value)}
    </div>
  )
}
