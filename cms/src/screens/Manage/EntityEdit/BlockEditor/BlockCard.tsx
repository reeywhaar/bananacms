'use client'

import { type FC, useEffect, useState } from 'react'
import type { BlockData, BlockTypeImage } from '#cms/lib/blocks/declarations.ts'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import { getAssetUrl } from '#cms/lib/getAssetUrl.ts'
import { formatSize } from '#cms/utils/formatSize.ts'
import { X } from '#cms/components/icons.tsx'
import { MetaView } from '../Meta/MetaView.tsx'

type BlockCardProps = {
  block: BlockData
  translations: Translations
  assetSizes: Record<string, number>
  onEdit: () => void
  onRemove: () => void
}

const contentTypeLabels = { plain: 'Plain', markdown: 'Markdown', html: 'HTML' }

// A block to read, in brief: its type and key, its content, and its attributes. A
// click on it, or Edit, opens it for editing.
export const BlockCard: FC<BlockCardProps> = ({
  block,
  translations,
  assetSizes,
  onEdit,
  onRemove,
}) => {
  const [removing, setRemoving] = useState(false)
  const { content } = block

  return (
    <div
      className={`flex cursor-pointer flex-col gap-2 rounded border p-3 shadow-sm transition-colors ${removing ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}
      onClick={onEdit}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-xs uppercase tracking-wide text-gray-400">
          {content.type}
          {content.type === 'text' && ` · ${contentTypeLabels[content.contentType ?? 'plain']}`}
        </span>
        {content.key && (
          <span className="truncate rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
            {content.key}
          </span>
        )}
        <div className="grow" />
        <button
          type="button"
          className="button-sm"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          Edit
        </button>
        <button
          type="button"
          aria-label="Remove block"
          className="button-sm-danger"
          onMouseEnter={() => setRemoving(true)}
          onMouseLeave={() => setRemoving(false)}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
      <BlockSummary block={block} assetSizes={assetSizes} />
      {block.attributes.length > 0 && (
        <MetaView attributes={block.attributes} translations={translations} />
      )}
    </div>
  )
}

const BlockSummary: FC<{ block: BlockData; assetSizes: Record<string, number> }> = ({
  block,
  assetSizes,
}) => {
  const { content } = block
  if (content.type === 'text' || content.type === 'meta') {
    return content.text ? (
      <p className="line-clamp-3 whitespace-pre-line text-sm text-gray-700">{content.text}</p>
    ) : (
      <span className="text-sm italic text-gray-400">Empty</span>
    )
  }
  if (content.type === 'image') return <ImageSummary content={content} />
  if (content.type === 'asset') {
    const name = content.pendingFile?.name ?? content.name
    const size = content.pendingFile?.size ?? assetSizes[content.assetId]
    if (!name) return <span className="text-sm italic text-gray-400">No file</span>
    return (
      <span className="truncate text-sm text-gray-700">
        {name}
        {size != null && <span className="text-gray-400"> · {formatSize(size)}</span>}
      </span>
    )
  }
  return null
}

// A new image's file shows through an object URL, and a saved one from its asset.
const ImageSummary: FC<{ content: BlockTypeImage }> = ({ content }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!content.pendingFile) return
    const url = URL.createObjectURL(content.pendingFile)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [content.pendingFile])

  const src = content.pendingFile ? objectUrl : content.assetId && getAssetUrl(content.assetId)
  const name = content.pendingFile?.name ?? content.name

  return (
    <div className="flex min-w-0 items-center gap-3">
      {src ? (
        <img
          src={src}
          alt={content.alt}
          className="h-16 w-24 shrink-0 rounded bg-gray-100 object-cover"
        />
      ) : (
        <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
          No image
        </div>
      )}
      <div className="flex min-w-0 flex-col text-sm">
        {name && <span className="truncate text-gray-700">{name}</span>}
        {content.alt && <span className="truncate text-gray-500">{content.alt}</span>}
      </div>
    </div>
  )
}
