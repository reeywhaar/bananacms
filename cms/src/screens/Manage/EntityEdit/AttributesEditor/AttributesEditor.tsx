'use client'

import type { FC } from 'react'
import { v7 } from 'uuid'
import { Languages, X } from '#cms/components/icons.tsx'
import type { AttributeData } from '#cms/services/AttributeStore.ts'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import { AutosizeTextarea } from '#cms/components/AutosizeTextarea/AutosizeTextarea.tsx'
import { LocalizableField } from '#cms/screens/Manage/LocalizableField.tsx'
import { useCMSLocales } from '#cms/components/CMSLocalesProvider/CMSLocalesProvider.tsx'

type AttributesEditorProps = {
  attributes: AttributeData[]
  onChange: (next: AttributeData[]) => void
  translations: Translations
  onTranslationsChange: (translations: Translations) => void
}

export const AttributesEditor: FC<AttributesEditorProps> = ({
  attributes,
  onChange,
  translations,
  onTranslationsChange,
}) => {
  const update = (id: string, patch: Partial<AttributeData>) => {
    onChange(attributes.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }

  const remove = (id: string) => {
    onChange(attributes.filter((a) => a.id !== id))
    onTranslationsChange(purgeAttributeTranslations(translations, id))
  }

  const add = () => {
    onChange([...attributes, { id: v7(), key: '', translatable: false, text: '' }])
  }

  const setTranslatable = (id: string, translatable: boolean) => {
    update(id, { translatable })
    if (!translatable) {
      onTranslationsChange(purgeAttributeTranslations(translations, id))
    }
  }

  const { locales } = useCMSLocales()
  const showTranslatable = locales.length >= 2

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs text-gray-500">Attributes</span>
      </div>
      {/* on a phone, where each takes two lines, a wider gap between them */}
      <div className="flex flex-col gap-3 sm:gap-2">
        {attributes.map((attr) => (
          // h-7.5 is the text's field at one line, which grows with more. On a phone,
          // the text goes on a line of its own, under the key and the buttons.
          <div key={attr.id} className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
            <input
              value={attr.key}
              onChange={(e) => update(attr.id, { key: e.target.value })}
              placeholder="key"
              className="input h-7.5 min-w-0 flex-1 sm:flex-[0_0_180px]"
            />
            {showTranslatable && (
              <button
                type="button"
                aria-label="Translatable"
                aria-pressed={attr.translatable}
                title="Translatable"
                onClick={() => setTranslatable(attr.id, !attr.translatable)}
                className={`flex h-7.5 shrink-0 items-center rounded border px-1.5 transition-colors ${
                  attr.translatable
                    ? 'gradient-accent border-transparent text-white'
                    : 'border-gray-300 text-gray-400 hover:text-gray-600'
                }`}
              >
                <Languages size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
            <LocalizableField
              label=""
              value={attr.text}
              onChange={(text) => update(attr.id, { text })}
              translationKey={'attribute:' + attr.id + ':text'}
              translations={translations}
              onTranslationsChange={onTranslationsChange}
              localizable={attr.translatable}
              className="order-last basis-full sm:order-none sm:basis-auto sm:flex-1"
              render={(value, onChange, _, placeholder) => (
                <AutosizeTextarea
                  value={value}
                  onChange={onChange}
                  placeholder={placeholder}
                  rows={1}
                />
              )}
            />
            <button
              type="button"
              className="button-sm-plain h-7.5"
              onClick={() => remove(attr.id)}
              aria-label="Remove attribute"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        ))}
        <button type="button" className="button-sm self-start" onClick={add}>
          + Attribute
        </button>
      </div>
    </div>
  )
}

export const purgeAttributeTranslations = (
  translations: Translations,
  attributeId: string,
): Translations => {
  const prefix = 'attribute:' + attributeId + ':'
  const result: Translations = {}
  for (const [locale, entries] of Object.entries(translations)) {
    const filtered: Record<string, string> = {}
    for (const [key, text] of Object.entries(entries)) {
      if (!key.startsWith(prefix)) filtered[key] = text
    }
    result[locale] = filtered
  }
  return result
}
