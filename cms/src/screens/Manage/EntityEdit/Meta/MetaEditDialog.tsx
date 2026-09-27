'use client'

import { type FC, useState } from 'react'
import type { AttributeData } from '#cms/services/AttributeStore.ts'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import { Dialog } from '#cms/components/Dialog/Dialog.tsx'
import { MetaFields } from './MetaFields.tsx'

type MetaEditDialogProps = {
  attributes: AttributeData[]
  translations: Translations
  onApply: (attributes: AttributeData[], translations: Translations) => void
  onClose: () => void
}

// Edits a copy of an entity's attributes, with their translations. Apply hands it
// back, to be written when the entity is saved; closing drops it. Rendered only
// while it's open, so each opening starts from what the entity has.
export const MetaEditDialog: FC<MetaEditDialogProps> = ({
  attributes,
  translations,
  onApply,
  onClose,
}) => {
  const [draftAttributes, setDraftAttributes] = useState(attributes)
  const [draftTranslations, setDraftTranslations] = useState(translations)

  return (
    <Dialog
      open
      onClose={onClose}
      title="Attributes"
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
              onApply(draftAttributes, draftTranslations)
              onClose()
            }}
          >
            Apply
          </button>
        </>
      }
    >
      <MetaFields
        attributes={draftAttributes}
        onAttributesChange={setDraftAttributes}
        translations={draftTranslations}
        onTranslationsChange={setDraftTranslations}
      />
    </Dialog>
  )
}
