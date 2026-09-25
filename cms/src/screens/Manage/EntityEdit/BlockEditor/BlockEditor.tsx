'use client'

import { type FC, useState } from 'react'
import type { BlockData } from '../../../../lib/blocks/declarations.ts'
import type { Translations } from '../../../../services/LocalizationStore.ts'
import type { AssetContent } from '../../../../services/AssetStore.ts'
import { BlockEdit } from './BlockEdit.tsx'
import { BlockReorderModal } from './BlockReorderModal.tsx'
import { SerializeModal } from './SerializeModal.tsx'
import { Code, List } from '../../../../components/icons.tsx'

type BlockEditorProps = {
  blocks: BlockData[]
  onChange: (blocks: BlockData[]) => void
  translations: Translations
  onTranslationsChange: (translations: Translations) => void
  assetContents?: Record<string, AssetContent>
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
