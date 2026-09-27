'use client'

import { type DragEvent, type FC, useState } from 'react'
import type { BlockTypeGroup, BlockData, BlockType } from '#cms/lib/blocks/declarations.ts'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import type { AssetContent } from '#cms/services/AssetStore.ts'
import { X } from '#cms/components/icons.tsx'
import { MetaView } from '../Meta/MetaView.tsx'
import { MetaEditDialog } from '../Meta/MetaEditDialog.tsx'
import { BlockCard } from './BlockCard.tsx'
import { BlockEditDialog } from './BlockEditDialog.tsx'
import { v7 } from 'uuid'

type BlockEditProps = {
  blocks: BlockData[]
  onChange: (blocks: BlockData[]) => void
  translations: Translations
  onTranslationsChange: (translations: Translations) => void
  assetContents?: Record<string, AssetContent>
  assetSizes?: Record<string, number>
}

// The block being edited in the dialog: one in the list at `index`, or a new one
// to add to it, when `index` is null.
type Editing = { index: number | null; block: BlockData }

// A list of blocks. Each is a card, edited in a dialog; a group shows its key and
// attributes, which a click on them, or Edit, opens in a dialog of their own, and
// its blocks in a list in place.
export const BlockEdit: FC<BlockEditProps> = ({
  blocks,
  onChange,
  translations,
  onTranslationsChange,
  assetContents = {},
  assetSizes = {},
}) => {
  const [dragging, setDragging] = useState(false)
  const [editing, setEditing] = useState<Editing | null>(null)

  const updateBlock = (index: number, updated: BlockData) => {
    const next = blocks.slice()
    next[index] = updated
    onChange(next)
  }

  const removeBlock = (index: number) => {
    const removed = blocks[index]
    onChange(blocks.filter((_, i) => i !== index))
    onTranslationsChange(purgeBlockTranslations(translations, removed))
  }

  const addBlock = (content: BlockType) => setEditing({ index: null, block: makeBlock(content) })

  const addGroupBlock = () => {
    const block = makeBlock({ type: 'group', key: '', blocks: [] })
    onChange([...blocks, block])
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (e.defaultPrevented) return
    if (!Array.from(e.dataTransfer.types).includes('Files')) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    setDragging(true)
  }

  const handleDragLeave = () => setDragging(false)

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    setDragging(false)
    if (e.defaultPrevented) return
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    e.preventDefault()
    e.stopPropagation()
    const newBlocks = files.map((file) =>
      file.type.startsWith('image/')
        ? makeBlock({
            type: 'image',
            key: '',
            name: file.name,
            alt: '',
            assetId: '',
            pendingFile: file,
          })
        : makeBlock({
            type: 'asset',
            key: '',
            name: file.name,
            assetId: '',
            pendingFile: file,
          }),
    )
    onChange([...blocks, ...newBlocks])
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded transition-colors ${dragging ? 'outline-2 outline-dashed outline-accent outline-offset-4' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {blocks.map((block, index) =>
        block.content.type === 'group' ? (
          <GroupRow
            key={block.id}
            block={block as BlockData & { content: BlockTypeGroup }}
            onUpdate={(updated) => updateBlock(index, updated)}
            onRemove={() => removeBlock(index)}
            translations={translations}
            onTranslationsChange={onTranslationsChange}
            assetContents={assetContents}
            assetSizes={assetSizes}
          />
        ) : (
          <BlockCard
            key={block.id}
            block={block}
            translations={translations}
            assetSizes={assetSizes}
            onEdit={() => setEditing({ index, block })}
            onRemove={() => removeBlock(index)}
          />
        ),
      )}
      <div className="flex gap-2">
        <button
          type="button"
          className="button-sm"
          onClick={() => addBlock({ type: 'text', key: '', contentType: 'plain', text: '' })}
        >
          + Text
        </button>
        <button
          type="button"
          className="button-sm"
          onClick={() => addBlock({ type: 'image', key: '', name: '', alt: '', assetId: '' })}
        >
          + Image
        </button>
        <button
          type="button"
          className="button-sm"
          onClick={() => addBlock({ type: 'asset', key: '', name: '', assetId: '' })}
        >
          + Asset
        </button>
        <button
          type="button"
          className="button-sm"
          onClick={() => addBlock({ type: 'meta', key: '', text: '' })}
        >
          + Meta
        </button>
        <button type="button" className="button-sm" onClick={addGroupBlock}>
          + Group
        </button>
      </div>
      {editing && (
        <BlockEditDialog
          block={editing.block}
          isNew={editing.index === null}
          translations={translations}
          assetContents={assetContents}
          assetSizes={assetSizes}
          onApply={(block, nextTranslations) => {
            if (editing.index === null) onChange([...blocks, block])
            else updateBlock(editing.index, block)
            onTranslationsChange(nextTranslations)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

type GroupRowProps = {
  block: BlockData & { content: BlockTypeGroup }
  onUpdate: (updated: BlockData) => void
  onRemove: () => void
  translations: Translations
  onTranslationsChange: (translations: Translations) => void
  assetContents: Record<string, AssetContent>
  assetSizes: Record<string, number>
}

const GroupRow: FC<GroupRowProps> = ({
  block,
  onUpdate,
  onRemove,
  translations,
  onTranslationsChange,
  assetContents,
  assetSizes,
}) => {
  const [removing, setRemoving] = useState(false)
  const [editing, setEditing] = useState(false)

  return (
    <div
      className={`flex flex-col gap-2 rounded border p-3 shadow-sm transition-colors ${removing ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-xs uppercase tracking-wide text-gray-400">
          {block.content.type}
        </span>
        {block.content.key && (
          <button
            type="button"
            className="truncate rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600 hover:bg-accent-100"
            onClick={() => setEditing(true)}
          >
            {block.content.key}
          </button>
        )}
        <div className="grow" />
        <button type="button" className="button-sm" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          type="button"
          aria-label="Remove block"
          className="button-sm-danger"
          onMouseEnter={() => setRemoving(true)}
          onMouseLeave={() => setRemoving(false)}
          onClick={onRemove}
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
      {block.attributes.length > 0 && (
        <div className="cursor-pointer" onClick={() => setEditing(true)}>
          <MetaView attributes={block.attributes} translations={translations} />
        </div>
      )}
      <div className="border-l border-gray-200 pl-4">
        <BlockEdit
          blocks={block.content.blocks}
          onChange={(children) =>
            onUpdate({ ...block, content: { ...block.content, blocks: children } })
          }
          translations={translations}
          onTranslationsChange={onTranslationsChange}
          assetContents={assetContents}
          assetSizes={assetSizes}
        />
      </div>
      {editing && (
        <MetaEditDialog
          title="Group block"
          keyName={block.content.key}
          attributes={block.attributes}
          translations={translations}
          onApply={(meta) => {
            onUpdate({
              ...block,
              content: { ...block.content, key: meta.key ?? '' },
              attributes: meta.attributes,
            })
            onTranslationsChange(meta.translations)
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}

const purgeBlockTranslations = (translations: Translations, block: BlockData): Translations => {
  const attributePrefixes = block.attributes.map((a) => 'attribute:' + a.id + ':')
  const result: Translations = {}
  for (const [locale, entries] of Object.entries(translations)) {
    const filtered: Record<string, string> = {}
    for (const [key, text] of Object.entries(entries)) {
      if (key.startsWith('block:' + block.id + ':')) continue
      if (attributePrefixes.some((p) => key.startsWith(p))) continue
      filtered[key] = text
    }
    result[locale] = filtered
  }
  if (block.content.type === 'group') {
    return block.content.blocks.reduce(purgeBlockTranslations, result)
  }
  return result
}

const makeBlock = (content: BlockType): BlockData => ({
  id: v7(),
  parent: { type: 'post', id: '' },
  content,
  attributes: [],
})
