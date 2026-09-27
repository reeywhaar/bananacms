'use client'

import { type FC, useState } from 'react'
import type {
  BlockData,
  BlockTypeAsset,
  BlockTypeImage,
  BlockTypeMeta,
  BlockTypeText,
} from '#cms/lib/blocks/declarations.ts'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import type { AssetContent, AssetImageContent } from '#cms/services/AssetStore.ts'
import { Dialog } from '#cms/components/Dialog/Dialog.tsx'
import { MetaFields } from '../Meta/MetaFields.tsx'
import { TextBlockEdit } from './TextBlockEdit.tsx'
import { ImageBlockEdit } from './ImageBlockEdit.tsx'
import { AssetBlockEdit } from './AssetBlockEdit.tsx'
import { MetaBlockEdit } from './MetaBlockEdit.tsx'
import { attributesInvalid } from '../AttributesEditor/AttributesEditor.tsx'

type BlockEditDialogProps = {
  block: BlockData
  // a block that isn't in the list yet: Add puts it there
  isNew: boolean
  translations: Translations
  assetContents: Record<string, AssetContent>
  assetSizes: Record<string, number>
  onApply: (block: BlockData, translations: Translations) => void
  onClose: () => void
}

const typeNames: Record<string, string> = {
  text: 'Text',
  image: 'Image',
  asset: 'Asset',
  meta: 'Meta',
}

// Edits a copy of a block, its content, key and attributes, with their
// translations. Apply, or Add for a new block, hands it back, to be written when
// the entity is saved; closing drops it. Rendered only while it's open, so each
// opening starts from the block as it is. An image's resolution, format and
// maximum size are its asset's, which the image editor saves as they change.
export const BlockEditDialog: FC<BlockEditDialogProps> = ({
  block,
  isNew,
  translations,
  assetContents,
  assetSizes,
  onApply,
  onClose,
}) => {
  const [draft, setDraft] = useState(block)
  const [draftTranslations, setDraftTranslations] = useState(translations)
  const invalid = attributesInvalid(draft.attributes)
  // Add or Apply has been pressed, so what's wrong with the attributes shows, until
  // it's put right, as in MetaEditDialog
  const [tried, setTried] = useState(false)
  if (tried && !invalid) setTried(false)
  const { content } = draft
  const assetId = content.type === 'image' || content.type === 'asset' ? content.assetId : ''
  const name = typeNames[content.type] ?? content.type

  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? `New ${name.toLowerCase()} block` : `${name} block`}
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
              if (invalid) {
                setTried(true)
                return
              }
              onApply(draft, draftTranslations)
              onClose()
            }}
          >
            {isNew ? 'Add' : 'Apply'}
          </button>
        </>
      }
    >
      {content.type === 'text' ? (
        <TextBlockEdit
          block={draft as BlockData & { content: BlockTypeText }}
          onChange={setDraft}
          translations={draftTranslations}
          onTranslationsChange={setDraftTranslations}
        />
      ) : content.type === 'image' ? (
        <ImageBlockEdit
          block={draft as BlockData & { content: BlockTypeImage }}
          content={imageContent(assetContents[assetId])}
          size={assetSizes[assetId] ?? null}
          onChange={setDraft}
          translations={draftTranslations}
          onTranslationsChange={setDraftTranslations}
        />
      ) : content.type === 'asset' ? (
        <AssetBlockEdit
          block={draft as BlockData & { content: BlockTypeAsset }}
          size={assetSizes[assetId] ?? null}
          content={assetContents[assetId] ?? null}
          onChange={setDraft}
        />
      ) : content.type === 'meta' ? (
        <MetaBlockEdit
          block={draft as BlockData & { content: BlockTypeMeta }}
          onChange={setDraft}
        />
      ) : null}
      <MetaFields
        keyName={content.key}
        onKeyChange={(key) => setDraft((d) => ({ ...d, content: { ...d.content, key } }))}
        attributes={draft.attributes}
        onAttributesChange={(attributes) => setDraft((d) => ({ ...d, attributes }))}
        translations={draftTranslations}
        onTranslationsChange={setDraftTranslations}
        showInvalid={tried}
      />
    </Dialog>
  )
}

// Content is only useful to the image editor when it is an image's.
const imageContent = (content: AssetContent | undefined): AssetImageContent | null =>
  content?.type === 'image' ? content : null
