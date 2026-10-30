'use client'

import { type FC, type DragEvent, useState, useRef } from 'react'
import type { BlockData, BlockTypeAsset } from '#cms/lib/blocks/declarations.ts'
import { describeAudio } from '#cms/lib/audioMeta.ts'
import type { AssetContent } from '#cms/services/AssetStore.ts'
import { getAssetUrl } from '#cms/lib/getAssetUrl.ts'
import { formatSize } from '#cms/utils/formatSize.ts'

type AssetBlockEditProps = {
  block: BlockData & { content: BlockTypeAsset }
  size: number | null
  // the asset's filename, which a download is saved as
  filename: string | null
  /** Whatever was measured from the file at upload; null for older assets. */
  content?: AssetContent | null
  onChange: (block: BlockData) => void
}

export const AssetBlockEdit: FC<AssetBlockEditProps> = ({
  block,
  size,
  filename,
  content,
  onChange,
}) => {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Another file takes the place of this one in the same block, which keeps its
  // id, key and attributes. The file is a new asset; the old one goes once
  // nothing uses it.
  const handleFile = (file: File) => {
    onChange({
      ...block,
      content: { ...block.content, assetId: '', pendingFile: file },
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

  const displayName = block.content.pendingFile?.name ?? filename
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
        dragging ? 'border-accent-500 bg-accent-50' : 'border-gray-200 hover:border-gray-400',
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
              className="text-xs text-link hover:underline"
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
