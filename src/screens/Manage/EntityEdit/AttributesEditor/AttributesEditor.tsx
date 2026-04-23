'use client'

import { FC } from 'react'
import { v7 } from 'uuid'
import { X } from '@deemlol/next-icons'
import { AttributeData } from '@cms/services/AttributeStore'
import { Translations } from '@cms/services/LocalizationStore'
import { AutosizeTextarea } from '@cms/components/AutosizeTextarea/AutosizeTextarea'
import { LocalizableField } from '../../LocalizableField'
import { useCMSLocales } from '@cms/components/CMSLocalesProvider/CMSLocalesProvider'

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
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-700">Attributes</span>
      </div>
      <div className="flex flex-col gap-2">
        {attributes.map((attr) => (
          <div key={attr.id} className="flex flex-row gap-2 items-start">
            <input
              value={attr.key}
              onChange={(e) => update(attr.id, { key: e.target.value })}
              placeholder="key"
              className="input-sm flex-[0_0_180px]"
            />
            {showTranslatable && (
              <label className="flex items-center gap-1 text-sm whitespace-nowrap pt-1">
                <input
                  type="checkbox"
                  checked={attr.translatable}
                  onChange={(e) => setTranslatable(attr.id, e.target.checked)}
                />
                translatable
              </label>
            )}
            {attr.translatable ? (
              <LocalizableField
                label=""
                value={attr.text}
                onChange={(text) => update(attr.id, { text })}
                translationKey={'attribute:' + attr.id + ':text'}
                translations={translations}
                onTranslationsChange={onTranslationsChange}
                className="flex-1"
                render={(value, onChange, _, placeholder) => (
                  <AutosizeTextarea
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    rows={1}
                  />
                )}
              />
            ) : (
              <AutosizeTextarea
                value={attr.text}
                onChange={(text) => update(attr.id, { text })}
                rows={1}
              />
            )}
            <button
              type="button"
              className="button-sm-danger"
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
