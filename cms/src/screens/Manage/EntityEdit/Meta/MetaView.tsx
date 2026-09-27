'use client'

import { type FC, useState } from 'react'
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
  // the language to show, when a switch around it picks it; without one, it has its own
  locale?: string
}

// A block's key and attributes, or an entity's attributes, to read. With more than
// one language, a translatable attribute has its languages before its text, green
// where it's translated, and a switch shows the attributes in another language,
// where one missing its translation shows its own text, greyed.
export const MetaView: FC<MetaViewProps> = ({
  keyName,
  attributes,
  translations,
  locale: outerLocale,
}) => {
  const { locales, default: defaultLocale } = useCMSLocales()
  const [ownLocale, setLocale] = useState(defaultLocale)
  const locale = outerLocale ?? ownLocale

  if (!keyName && attributes.length === 0) {
    return <span className="text-sm italic text-gray-400">No attributes</span>
  }

  const translatable = attributes.filter((attr) => attr.translatable)
  const translated = (attr: AttributeData, code: string) =>
    translations[code]?.['attribute:' + attr.id + ':text']
  const isFilled = (code: string) =>
    code === defaultLocale || translatable.every((attr) => !attr.text || !!translated(attr, code))
  const withStatus = locales.length > 1 && translatable.length > 0

  return (
    <div className="flex flex-col gap-1 text-sm">
      {keyName && (
        <span className="self-start rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
          {keyName}
        </span>
      )}
      {attributes.length > 0 && (
        <div className="flex items-start gap-4">
          <dl
            className={`grid min-w-0 flex-1 gap-x-4 gap-y-1 ${withStatus ? 'grid-cols-[minmax(0,max-content)_max-content_minmax(0,1fr)]' : 'grid-cols-[minmax(0,max-content)_minmax(0,1fr)]'}`}
          >
            {attributes.map((attr) => {
              const text =
                attr.translatable && locale !== defaultLocale ? translated(attr, locale) : attr.text
              return (
                <div key={attr.id} className="contents">
                  <dt className="wrap-anywhere text-gray-500">{attr.key || '—'}</dt>
                  {withStatus && (
                    <span className="flex h-5 items-center">
                      {attr.translatable && (
                        <LocaleStatus
                          text={attr.text}
                          translationKey={'attribute:' + attr.id + ':text'}
                          translations={translations}
                        />
                      )}
                    </span>
                  )}
                  <dd className={`wrap-anywhere ${text ? 'text-gray-800' : 'text-gray-400'}`}>
                    {text || attr.text}
                  </dd>
                </div>
              )
            })}
          </dl>
          {outerLocale === undefined && withStatus && (
            <div className="-mt-1.5 shrink-0">
              <LocaleSwitch active={locale} onChange={setLocale} isFilled={isFilled} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
