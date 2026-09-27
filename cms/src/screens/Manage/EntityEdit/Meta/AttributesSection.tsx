'use client'

import { type FC, useState } from 'react'
import type { AttributeData } from '#cms/services/AttributeStore.ts'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import { MetaView } from './MetaView.tsx'
import { MetaEditDialog } from './MetaEditDialog.tsx'

type AttributesSectionProps = {
  attributes: AttributeData[]
  onChange: (attributes: AttributeData[]) => void
  translations: Translations
  onTranslationsChange: (translations: Translations) => void
}

// An entity's attributes, to read, and edited in a MetaEditDialog that a click on
// them, or Edit, opens.
export const AttributesSection: FC<AttributesSectionProps> = ({
  attributes,
  onChange,
  translations,
  onTranslationsChange,
}) => {
  const [editing, setEditing] = useState(false)

  return (
    <>
      <div
        className="flex w-full cursor-pointer flex-col gap-1 rounded border border-gray-200 px-3 py-2 hover:border-gray-300"
        onClick={() => setEditing(true)}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Attributes</span>
          <button
            type="button"
            className="button-sm"
            onClick={(e) => {
              e.stopPropagation()
              setEditing(true)
            }}
          >
            Edit
          </button>
        </div>
        <MetaView attributes={attributes} translations={translations} />
      </div>
      {editing && (
        <MetaEditDialog
          title="Attributes"
          attributes={attributes}
          translations={translations}
          onApply={(meta) => {
            onChange(meta.attributes)
            onTranslationsChange(meta.translations)
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  )
}
