'use client'

import { type FC, type DragEvent, useState, useRef } from 'react'
import type { BlockData, BlockTypeAsset } from '#cms/lib/blocks/declarations.ts'
import { describeAudio } from '#cms/lib/audioMeta.ts'
import type { AssetContent } from '#cms/services/AssetStore.ts'
import { getAssetUrl } from '#cms/lib/getAssetUrl.ts'
import { formatSize } from '#cms/utils/formatSize.ts'
import { AudioPlayer } from './AudioPlayer.tsx'
import { FilenameField } from './FilenameField.tsx'

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
      content: { ...block.content, assetId: '', pendingFile: file, pendingFilename: undefined },
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
  const stagedAudio = block.content.pendingFile?.type.startsWith('audio/')
    ? block.content.pendingFile
    : null

  return (
    <div
      className={[
        'border-2 border-dashed rounded p-4 flex flex-col items-start gap-4 cursor-pointer transition-colors',
        dragging ? 'border-accent-500 bg-accent-50' : 'border-gray-200 hover:border-gray-400',
      ].join(' ')}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {displayName ? (
        // the file and what it says of itself, close together, then its player
        <div className="flex w-full flex-col gap-3">
          <div className="flex flex-col gap-1">
            <FilenameField
              name={displayName}
              pending={block.content.pendingFilename}
              onChange={(pendingFilename) =>
                onChange({ ...block, content: { ...block.content, pendingFilename } })
              }
            />
            <div className="flex flex-col gap-0.5 text-xs text-gray-500">
              <span>
                {fileSize != null && formatSize(fileSize)}
                {assetUrl && (
                  <>
                    {fileSize != null && ' · '}
                    <a
                      href={assetUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-link hover:underline"
                    >
                      Open
                    </a>
                  </>
                )}
              </span>
              {tagLine && <span>{tagLine}</span>}
              {audioInfo && <span>{audioInfo}</span>}
            </div>
          </div>
          {stagedAudio ? (
            <AudioPlayer file={stagedAudio} />
          ) : (
            audio && assetUrl && <AudioPlayer src={assetUrl} duration={audio.duration} />
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
