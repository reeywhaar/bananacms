'use client'

import { type FC, useState } from 'react'
import type { AttributeData } from '#cms/services/AttributeStore.ts'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import { Dialog } from '#cms/components/Dialog/Dialog.tsx'
import { MetaFields } from './MetaFields.tsx'

type MetaEditDialogProps = {
  title: string
  // a block's key, edited with its attributes; an entity has none
  keyName?: string
  attributes: AttributeData[]
  translations: Translations
  onApply: (meta: {
    key: string | undefined
    attributes: AttributeData[]
    translations: Translations
  }) => void
  onClose: () => void
}

// Edits a copy of a block's key and attributes, or of an entity's attributes, with
// their translations. Apply hands it back, to be written when the entity is saved;
// closing drops it. Rendered only while it's open, so each opening starts from
// what there is.
export const MetaEditDialog: FC<MetaEditDialogProps> = ({
  title,
  keyName,
  attributes,
  translations,
  onApply,
  onClose,
}) => {
  const [draftKey, setDraftKey] = useState(keyName)
  const [draftAttributes, setDraftAttributes] = useState(attributes)
  const [draftTranslations, setDraftTranslations] = useState(translations)

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      wide
      footer={
        <>
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button"
            onClick={() => {
              onApply({
                key: draftKey,
                attributes: draftAttributes,
                translations: draftTranslations,
              })
              onClose()
            }}
          >
            Apply
          </button>
        </>
      }
    >
      <MetaFields
        keyName={draftKey}
        onKeyChange={setDraftKey}
        attributes={draftAttributes}
        onAttributesChange={setDraftAttributes}
        translations={draftTranslations}
        onTranslationsChange={setDraftTranslations}
      />
    </Dialog>
  )
}
