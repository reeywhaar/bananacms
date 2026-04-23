'use client'

import { FC, useState } from 'react'
import { BlockData } from '@cms/lib/blocks/declarations'
import { Translations } from '@cms/services/LocalizationStore'
import { AssetContent } from '@cms/services/AssetStore'
import { BlockEdit } from './BlockEdit'
import { BlockReorderModal } from './BlockReorderModal'
import { SerializeModal } from './SerializeModal'
import { Code, List } from '@deemlol/next-icons'

type BlockEditorProps = {
  blocks: BlockData[]
  onChange: (blocks: BlockData[]) => void
  translations: Translations
  onTranslationsChange: (translations: Translations) => void
  assetContents?: Record<string, AssetContent | null>
  assetSizes?: Record<string, number>
}

export const BlockEditor: FC<BlockEditorProps> = ({
  blocks,
  onChange,
  translations,
  onTranslationsChange,
  assetContents = {},
  assetSizes = {},
}) => {
  const [serializeModalOpen, setSerializeModalOpen] = useState(false)
  const [reorderModalOpen, setReorderModalOpen] = useState(false)

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-700">Blocks</span>
        <div className="flex gap-2">
          {blocks.length > 0 && (
            <button type="button" className="button-sm" onClick={() => setReorderModalOpen(true)}>
              <List size={18} strokeWidth={2} />
            </button>
          )}
          {blocks.length > 0 && (
            <button
              type="button"
              className="button-sm font-mono"
              onClick={() => setSerializeModalOpen(true)}
            >
              <Code size={18} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
      <BlockEdit
        blocks={blocks}
        onChange={onChange}
        translations={translations}
        onTranslationsChange={onTranslationsChange}
        assetContents={assetContents}
        assetSizes={assetSizes}
      />
      {serializeModalOpen && (
        <SerializeModal
          blocks={blocks}
          translations={translations}
          onSave={(newBlocks, newTranslations) => {
            onChange(newBlocks)
            onTranslationsChange(newTranslations)
          }}
          onClose={() => setSerializeModalOpen(false)}
        />
      )}
      {reorderModalOpen && (
        <BlockReorderModal
          blocks={blocks}
          onSave={onChange}
          onClose={() => setReorderModalOpen(false)}
        />
      )}
    </div>
  )
}
