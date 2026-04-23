'use client'

import { DragEvent, FC, useState } from 'react'
import {
  BlockTypeText,
  BlockTypeGroup,
  BlockTypeImage,
  BlockTypeMeta,
  BlockTypeAsset,
  TextBlockContentType,
  BlockData,
  BlockType,
} from '@cms/lib/blocks/declarations'
import { Translations } from '@cms/services/LocalizationStore'
import { AssetImageContent } from '@cms/services/AssetStore'
import { LocalizableField } from '../../LocalizableField'
import { ImageBlockEdit } from './ImageBlockEdit'
import { AssetBlockEdit } from './AssetBlockEdit'
import { AttributesEditor } from '../AttributesEditor/AttributesEditor'
import { AutosizeTextarea } from '@cms/components/AutosizeTextarea/AutosizeTextarea'
import { SegmentedControl } from '@cms/components/SegmentedControl/SegmentedControl'
import { X } from '@deemlol/next-icons'
import { v7 } from 'uuid'

type BlockEditProps = {
  blocks: BlockData[]
  onChange: (blocks: BlockData[]) => void
  translations: Translations
  onTranslationsChange: (translations: Translations) => void
  assetContents?: Record<string, AssetImageContent>
  assetSizes?: Record<string, number>
}

export const BlockEdit: FC<BlockEditProps> = ({
  blocks,
  onChange,
  translations,
  onTranslationsChange,
  assetContents = {},
  assetSizes = {},
}) => {
  const [dragging, setDragging] = useState(false)

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

  const addTextBlock = () => {
    const block = makeBlock({ type: 'text', key: '', contentType: 'plain', text: '' })
    onChange([...blocks, block])
  }

  const addGroupBlock = () => {
    const block = makeBlock({ type: 'group', key: '', blocks: [] })
    onChange([...blocks, block])
  }

  const addImageBlock = () => {
    const block = makeBlock({ type: 'image', key: '', name: '', alt: '', assetId: '' })
    onChange([...blocks, block])
  }

  const addMetaBlock = () => {
    const block = makeBlock({ type: 'meta', key: '', text: '' })
    onChange([...blocks, block])
  }

  const addAssetBlock = () => {
    const block = makeBlock({ type: 'asset', key: '', name: '', assetId: '' })
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
      className={`flex flex-col gap-3 rounded transition-colors ${dragging ? 'outline-2 outline-dashed outline-blue-300 outline-offset-4' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {blocks.map((block, index) => (
        <BlockRow
          key={block.id}
          block={block}
          onUpdate={(updated) => updateBlock(index, updated)}
          onRemove={() => removeBlock(index)}
          translations={translations}
          onTranslationsChange={onTranslationsChange}
          assetContents={assetContents}
          assetSizes={assetSizes}
        />
      ))}
      <div className="flex gap-2">
        <button type="button" className="button-sm" onClick={addTextBlock}>
          + Text
        </button>
        <button type="button" className="button-sm" onClick={addImageBlock}>
          + Image
        </button>
        <button type="button" className="button-sm" onClick={addAssetBlock}>
          + Asset
        </button>
        <button type="button" className="button-sm" onClick={addMetaBlock}>
          + Meta
        </button>
        <button type="button" className="button-sm" onClick={addGroupBlock}>
          + Group
        </button>
      </div>
    </div>
  )
}

type BlockRowProps = {
  block: BlockData
  onUpdate: (updated: BlockData) => void
  onRemove: () => void
  translations: Translations
  onTranslationsChange: (translations: Translations) => void
  assetContents: Record<string, AssetImageContent>
  assetSizes: Record<string, number>
}

const BlockRow: FC<BlockRowProps> = ({
  block,
  onUpdate,
  onRemove,
  translations,
  onTranslationsChange,
  assetContents,
  assetSizes,
}) => {
  const [removing, setRemoving] = useState(false)

  const updateKey = (key: string) => {
    onUpdate({ ...block, content: { ...block.content, key } })
  }

  return (
    <div
      className={`border rounded p-3 flex flex-col gap-2 shadow-sm transition-colors ${removing ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
    >
      <div className="flex items-center gap-4 mb-2 border-b border-gray-200 pb-2">
        <span className="text-xs text-gray-400 uppercase tracking-wide shrink-0">
          {block.content.type}
        </span>
        <div className="w-4 grow-1" />
        <input
          value={block.content.key}
          onChange={(e) => updateKey(e.target.value)}
          placeholder="key"
          className="input-sm py-0 flex-1 max-w-[400px]"
        />
        <button
          type="button"
          className="button-sm-danger"
          onMouseEnter={() => setRemoving(true)}
          onMouseLeave={() => setRemoving(false)}
          onClick={onRemove}
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
      {block.content.type === 'text' ? (
        <TextBlockEdit
          block={block as BlockData & { content: BlockTypeText }}
          onChange={onUpdate}
          translations={translations}
          onTranslationsChange={onTranslationsChange}
        />
      ) : block.content.type === 'image' ? (
        <ImageBlockEdit
          block={block as BlockData & { content: BlockTypeImage }}
          content={assetContents[(block.content as BlockTypeImage).assetId] ?? null}
          size={assetSizes[(block.content as BlockTypeImage).assetId] ?? null}
          onChange={onUpdate}
          translations={translations}
          onTranslationsChange={onTranslationsChange}
        />
      ) : block.content.type === 'meta' ? (
        <MetaBlockEdit
          block={block as BlockData & { content: BlockTypeMeta }}
          onChange={onUpdate}
        />
      ) : block.content.type === 'asset' ? (
        <AssetBlockEdit
          block={block as BlockData & { content: BlockTypeAsset }}
          size={assetSizes[(block.content as BlockTypeAsset).assetId] ?? null}
          onChange={onUpdate}
        />
      ) : (
        <GroupBlockEdit
          block={block as BlockData & { content: BlockTypeGroup }}
          onChange={onUpdate}
          translations={translations}
          onTranslationsChange={onTranslationsChange}
          assetContents={assetContents}
          assetSizes={assetSizes}
        />
      )}
      <AttributesEditor
        attributes={block.attributes}
        onChange={(attrs) => onUpdate({ ...block, attributes: attrs })}
        translations={translations}
        onTranslationsChange={onTranslationsChange}
      />
    </div>
  )
}

type TextBlockEditProps = {
  block: BlockData & { content: BlockTypeText }
  onChange: (block: BlockData) => void
  translations: Translations
  onTranslationsChange: (translations: Translations) => void
}

const TextBlockEdit: FC<TextBlockEditProps> = ({
  block,
  onChange,
  translations,
  onTranslationsChange,
}) => {
  const update = (patch: Partial<BlockTypeText>) => {
    onChange({ ...block, content: { ...block.content, ...patch } })
  }

  const contentTypeOptions: { value: TextBlockContentType; label: string }[] = [
    { value: 'plain', label: 'Plain' },
    { value: 'markdown', label: 'Markdown' },
    { value: 'html', label: 'HTML' },
  ]

  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl
        value={block.content.contentType ?? 'plain'}
        onChange={(contentType) => update({ contentType })}
        options={contentTypeOptions}
        size="sm"
        className="max-w-[400px]"
      />
      <LocalizableField
        label="Text"
        value={block.content.text}
        onChange={(text) => update({ text })}
        translationKey={'block:' + block.id + ':text'}
        translations={translations}
        onTranslationsChange={onTranslationsChange}
        className="input-cnt"
        render={(value, onChange, label, placeholder) => (
          <label className="label">
            <span>{label}</span>
            <AutosizeTextarea value={value} onChange={onChange} placeholder={placeholder} />
          </label>
        )}
      />
    </div>
  )
}

type MetaBlockEditProps = {
  block: BlockData & { content: BlockTypeMeta }
  onChange: (block: BlockData) => void
}

const MetaBlockEdit: FC<MetaBlockEditProps> = ({ block, onChange }) => {
  const update = (patch: Partial<BlockTypeMeta>) => {
    onChange({ ...block, content: { ...block.content, ...patch } })
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="label">
        <span>Text</span>
        <AutosizeTextarea value={block.content.text} onChange={(text) => update({ text })} />
      </label>
    </div>
  )
}

type GroupBlockEditProps = {
  block: BlockData & { content: BlockTypeGroup }
  onChange: (block: BlockData) => void
  translations: Translations
  onTranslationsChange: (translations: Translations) => void
  assetContents: Record<string, AssetImageContent>
  assetSizes: Record<string, number>
}

const GroupBlockEdit: FC<GroupBlockEditProps> = ({
  block,
  onChange,
  translations,
  onTranslationsChange,
  assetContents,
  assetSizes,
}) => {
  const updateChildren = (children: BlockData[]) => {
    onChange({ ...block, content: { ...block.content, blocks: children } })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="pl-4 border-l border-gray-200">
        <BlockEdit
          blocks={block.content.blocks}
          onChange={updateChildren}
          translations={translations}
          onTranslationsChange={onTranslationsChange}
          assetContents={assetContents}
          assetSizes={assetSizes}
        />
      </div>
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
