'use client'

import { FC, DragEvent, useState, useRef } from 'react'
import { BlockData, BlockTypeAsset } from '@cms/lib/blocks/declarations'
import { describeAudio } from '@cms/lib/audioMeta'
import type { AssetContent } from '@cms/services/AssetStore'
import { getAssetUrl } from '@cms/lib/getAssetUrl'
import { v7 } from 'uuid'

const formatSize = (bytes: number): string => {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(2)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

type AssetBlockEditProps = {
  block: BlockData & { content: BlockTypeAsset }
  size: number | null
  /** Whatever was measured from the file at upload; null for older assets. */
  content?: AssetContent | null
  onChange: (block: BlockData) => void
}

export const AssetBlockEdit: FC<AssetBlockEditProps> = ({ block, size, content, onChange }) => {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    onChange({
      id: v7(),
      parent: block.parent,
      content: {
        type: 'asset',
        key: block.content.key,
        name: file.name,
        assetId: '',
        pendingFile: file,
      },
      attributes: block.attributes,
    })
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => setDragging(false)

  const displayName = block.content.pendingFile?.name ?? block.content.name
  const fileSize = block.content.pendingFile?.size ?? (block.content.assetId ? size : null)
  const assetUrl = block.content.assetId ? getAssetUrl(block.content.assetId) : null

  // Read-only: measured from the file, not something to edit here. Every field
  // is optional — plenty of files declare almost nothing — so these render only
  // when there is something to say, and the block looks exactly as it did
  // before when there is not.
  const audio = content?.type === 'audio' ? content : null
  const audioInfo = audio ? describeAudio(audio) : ''
  const audioTags = audio?.tags
  const tagLine = [audioTags?.title, audioTags?.artist].filter(Boolean).join(' — ')

  return (
    <div
      className={[
        'border-2 border-dashed rounded p-4 flex flex-col items-center gap-2 cursor-pointer transition-colors',
        dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-400',
      ].join(' ')}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {displayName ? (
        <div className="text-sm text-gray-700 flex flex-col items-center gap-0.5">
          <span className="font-mono break-all text-center">{displayName}</span>
          {fileSize != null && (
            <span className="text-xs text-gray-500">{formatSize(fileSize)}</span>
          )}
          {tagLine && <span className="text-xs text-gray-500">{tagLine}</span>}
          {audioInfo && <span className="text-xs text-gray-500">{audioInfo}</span>}
          {assetUrl && (
            <a
              href={assetUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-blue-600 hover:underline"
            >
              Open
            </a>
          )}
        </div>
      ) : (
        <span className="text-sm text-gray-400">Drop file here or click to select</span>
      )}
      {displayName && <span className="text-xs text-gray-400">Drop or click to replace</span>}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
