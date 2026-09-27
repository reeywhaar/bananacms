'use client'

import type { FC } from 'react'
import type { AttributeData } from '#cms/services/AttributeStore.ts'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import { useCMSLocales } from '#cms/components/CMSLocalesProvider/CMSLocalesProvider.tsx'
import { LocaleSwitch } from '#cms/screens/Manage/LocaleSwitch.tsx'
import { LocaleStatus } from '#cms/screens/Manage/LocaleStatus.tsx'

type MetaViewProps = {
  // a block's key; an entity has none
  keyName?: string
  attributes: AttributeData[]
  translations: Translations
  // the language to show, which an AttributesLocaleSwitch in the header over it picks
  locale: string
}

// A block's key and attributes, or an entity's attributes, to read, in `locale`,
// where one missing its translation shows its own text, greyed. With more than one
// language, a translatable attribute has its languages after its key, green where
// it's translated.
export const MetaView: FC<MetaViewProps> = ({ keyName, attributes, translations, locale }) => {
  const { locales, default: defaultLocale } = useCMSLocales()

  if (!keyName && attributes.length === 0) {
    return <span className="text-sm italic text-gray-400">No attributes</span>
  }

  const translated = (attr: AttributeData, code: string) =>
    translations[code]?.['attribute:' + attr.id + ':text']

  return (
    <div className="flex flex-col gap-1 text-sm">
      {keyName && (
        <span className="self-start rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
          {keyName}
        </span>
      )}
      {attributes.length > 0 && (
        <dl className="grid min-w-0 grid-cols-[minmax(0,max-content)_minmax(0,1fr)] gap-x-4 gap-y-1">
          {attributes.map((attr) => {
            const text =
              attr.translatable && locale !== defaultLocale ? translated(attr, locale) : attr.text
            return (
              <div key={attr.id} className="contents">
                <dt className="wrap-anywhere text-gray-500">
                  {attr.key || '—'}
                  {locales.length > 1 && attr.translatable && (
                    <span className="ml-1.5">
                      <LocaleStatus
                        text={attr.text}
                        translationKey={'attribute:' + attr.id + ':text'}
                        translations={translations}
                      />
                    </span>
                  )}
                </dt>
                <dd className={`wrap-anywhere ${text ? 'text-gray-800' : 'text-gray-400'}`}>
                  {text || attr.text}
                </dd>
              </div>
            )
          })}
        </dl>
      )}
    </div>
  )
}

type AttributesLocaleSwitchProps = {
  attributes: AttributeData[]
  translations: Translations
  active: string
  onChange: (locale: string) => void
}

// The switch between the languages of attributes, for the header over their
// MetaView: a language is green where each translatable attribute with a text has
// it in that language. There's none with one language, or nothing to translate.
export const AttributesLocaleSwitch: FC<AttributesLocaleSwitchProps> = ({
  attributes,
  translations,
  active,
  onChange,
}) => {
  const { locales, default: defaultLocale } = useCMSLocales()
  if (locales.length < 2 || !attributes.some((attr) => attr.translatable)) return null
  const isFilled = (code: string) =>
    code === defaultLocale ||
    attributes.every(
      (attr) =>
        !attr.translatable ||
        !attr.text ||
        !!translations[code]?.['attribute:' + attr.id + ':text'],
    )
  return <LocaleSwitch active={active} onChange={onChange} isFilled={isFilled} />
}
