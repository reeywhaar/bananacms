'use client'

import type { FC } from 'react'
import type { AttributeData } from '#cms/services/AttributeStore.ts'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import { AttributesEditor } from '../AttributesEditor/AttributesEditor.tsx'

type MetaFieldsProps = {
  // a block's key, and its field; an entity has neither
  keyName?: string
  onKeyChange?: (key: string) => void
  attributes: AttributeData[]
  onAttributesChange: (attributes: AttributeData[]) => void
  translations: Translations
  onTranslationsChange: (translations: Translations) => void
}

// The fields for a block's key and attributes, or an entity's attributes.
export const MetaFields: FC<MetaFieldsProps> = ({
  keyName,
  onKeyChange,
  attributes,
  onAttributesChange,
  translations,
  onTranslationsChange,
}) => (
  <div className="flex flex-col gap-3">
    {keyName !== undefined && onKeyChange && (
      <label className="label">
        <span>Key</span>
        <input
          value={keyName}
          onChange={(e) => onKeyChange(e.target.value)}
          placeholder="key"
          className="input"
        />
      </label>
    )}
    <AttributesEditor
      attributes={attributes}
      onChange={onAttributesChange}
      translations={translations}
      onTranslationsChange={onTranslationsChange}
    />
  </div>
)
