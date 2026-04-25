'use client'

import { FC, DragEvent, useEffect, useRef, useState } from 'react'
import { BlockData, BlockTypeImage } from '@cms/lib/blocks/declarations'
import { AssetContent, AssetOutputFormat, AssetResolution } from '@cms/services/AssetStore'
import { Translations } from '@cms/services/LocalizationStore'
import { LocalizableField } from '../../LocalizableField'
import { getAssetUrl } from '@cms/lib/getAssetUrl'
import { updateAssetContent } from './actions'
import { useToast } from '@cms/components/Toast/Toast'
import { useWithProgress } from '@cms/components/ProgressOverlay/ProgressOverlay'
import { extractErrorMessage } from '@cms/utils/extractErrorMessage'
import { v7 } from 'uuid'

const RESOLUTIONS: AssetResolution[] = ['@1x', '@2x', '@3x']

type FormatType = AssetOutputFormat['type']
const FORMATS: FormatType[] = ['original', 'gif', 'png8', 'png24', 'jpeg', 'webp']
const QUALITIES = [60, 70, 75, 85, 100] as const
const DEFAULT_QUALITY = 75

const hasQuality = (f: AssetOutputFormat): f is Extract<AssetOutputFormat, { quality: number }> =>
  f.type === 'jpeg' || f.type === 'webp'

const formatSize = (bytes: number): string => {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(2)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

const defaultFormatFor = (type: FormatType): AssetOutputFormat => {
  if (type === 'jpeg' || type === 'webp') return { type, quality: DEFAULT_QUALITY }
  return { type }
}

type ImageBlockEditProps = {
  block: BlockData & { content: BlockTypeImage }
  content: AssetContent | null
  size: number | null
  onChange: (block: BlockData) => void
  translations: Translations
  onTranslationsChange: (translations: Translations) => void
}

export const ImageBlockEdit: FC<ImageBlockEditProps> = ({
  block,
  content,
  size,
  onChange,
  translations,
  onTranslationsChange,
}) => {
  const [dragging, setDragging] = useState(false)
  const [objectUrl] = useState<string | null>(() => {
    const pf = block.content.pendingFile
    return pf ? URL.createObjectURL(pf) : null
  })
  const [naturalDims, setNaturalDims] = useState<{ width: number; height: number } | null>(null)
  const [resolution, setResolution] = useState<AssetResolution>(
    block.content.pendingResolution ?? content?.resolution ?? '@1x',
  )
  const [format, setFormat] = useState<AssetOutputFormat>(
    block.content.pendingOutputAs ?? content?.output_as ?? { type: 'original' },
  )
  const initialMaxSize = block.content.pendingMaxSize ?? content?.maxSize ?? null
  const [maxSize, setMaxSize] = useState<{ width: number; height: number } | null>(initialMaxSize)
  const [maxWidthInput, setMaxWidthInput] = useState<string>(
    initialMaxSize ? String(initialMaxSize.width) : '',
  )
  const [maxHeightInput, setMaxHeightInput] = useState<string>(
    initialMaxSize ? String(initialMaxSize.height) : '',
  )
  const objectUrlRef = useRef<string | null>(objectUrl)
  const inputRef = useRef<HTMLInputElement>(null)
  const withProgress = useWithProgress()
  const showToast = useToast()

  // Revoke the object URL when the component unmounts
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const url = objectUrlRef.current
      if (url) URL.revokeObjectURL(url)
    }
  }, [])

  useEffect(() => {
    const file = block.content.pendingFile
    if (!file) return
    let cancelled = false
    createImageBitmap(file).then(
      (bmp) => {
        if (!cancelled) setNaturalDims({ width: bmp.width, height: bmp.height })
        bmp.close()
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [block.content.pendingFile])

  const update = (patch: Partial<BlockTypeImage>) => {
    onChange({ ...block, content: { ...block.content, ...patch } })
  }

  const handleFile = (file: File) => {
    onChange({
      id: v7(),
      parent: block.parent,
      type: 'image',
      content: {
        type: 'image',
        key: block.content.key,
        name: file.name,
        alt: '',
        assetId: '',
        pendingFile: file,
      },
      attributes: block.attributes,
    })
  }

  const persistContent = (next: {
    resolution: AssetResolution
    output_as: AssetOutputFormat
    maxSize: { width: number; height: number } | null
  }) => {
    if (block.content.pendingFile) {
      update({
        pendingResolution: next.resolution,
        pendingOutputAs: next.output_as,
        pendingMaxSize: next.maxSize ?? undefined,
      })
      return
    }
    if (!block.content.assetId) return
    withProgress(async () => {
      try {
        await updateAssetContent(block.content.assetId, {
          resolution: next.resolution,
          output_as: next.output_as,
          maxSize: next.maxSize,
        })
      } catch (e) {
        showToast('error', extractErrorMessage(e), { timeout: 3000 })
      }
    })
  }

  const displayDims =
    naturalDims ??
    (content?.width && content?.height ? { width: content.width, height: content.height } : null)

  const handleResolutionChange = (next: AssetResolution) => {
    setResolution(next)
    persistContent({ resolution: next, output_as: format, maxSize })
  }

  const handleFormatTypeChange = (nextType: FormatType) => {
    const next = defaultFormatFor(nextType)
    setFormat(next)
    persistContent({ resolution, output_as: next, maxSize })
  }

  const handleQualityChange = (quality: number) => {
    if (!hasQuality(format)) return
    const next: AssetOutputFormat = { type: format.type, quality }
    setFormat(next)
    persistContent({ resolution, output_as: next, maxSize })
  }

  const commitMaxSize = () => {
    if (maxSize === null) return
    const wN = Number(maxWidthInput)
    const hN = Number(maxHeightInput)
    if (!Number.isInteger(wN) || wN <= 0 || !Number.isInteger(hN) || hN <= 0) {
      setMaxWidthInput(String(maxSize.width))
      setMaxHeightInput(String(maxSize.height))
      return
    }
    if (maxSize.width === wN && maxSize.height === hN) return
    const next = { width: wN, height: hN }
    setMaxSize(next)
    persistContent({ resolution, output_as: format, maxSize: next })
  }

  const handleMaxSizeToggle = (checked: boolean) => {
    if (checked) {
      const seed = displayDims ?? { width: 1, height: 1 }
      setMaxWidthInput(String(seed.width))
      setMaxHeightInput(String(seed.height))
      setMaxSize(seed)
      persistContent({ resolution, output_as: format, maxSize: seed })
    } else {
      setMaxSize(null)
      persistContent({ resolution, output_as: format, maxSize: null })
    }
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

  const previewSrc = objectUrl ?? getAssetUrl(block.content.assetId)
  const displayName = block.content.pendingFile?.name ?? block.content.name
  const fileSize = block.content.pendingFile?.size ?? (block.content.assetId ? size : null)

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div
          className={[
            'border-2 border-dashed rounded p-4 flex flex-col items-center gap-2 cursor-pointer transition-colors',
            dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-400',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewSrc} alt={block.content.alt} className="max-h-48 object-contain" />
          ) : (
            <span className="text-sm text-gray-400">Drop image here or click to select</span>
          )}
          {previewSrc && (
            <div className="text-xs text-gray-500 flex flex-col items-center gap-0.5">
              {displayName && <span>{displayName}</span>}
              {displayDims && (
                <span>
                  {displayDims.width} × {displayDims.height}
                </span>
              )}
              {fileSize != null && <span>{formatSize(fileSize)}</span>}
            </div>
          )}
          {previewSrc && <span className="text-xs text-gray-400">Drop or click to replace</span>}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ''
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <LocalizableField
            label="Alt text"
            value={block.content.alt}
            onChange={(alt) => update({ alt })}
            translationKey={'block:' + block.id + ':alt'}
            translations={translations}
            onTranslationsChange={onTranslationsChange}
            className="input-cnt"
            render={(value, onChange, label, placeholder) => (
              <label className="label">
                <span>{label}</span>
                <input
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder}
                  className="input"
                />
              </label>
            )}
          />

          <div className="flex flex-row gap-2">
            <div className="input-cnt">
              <label className="label">
                <span>Resolution</span>
                <select
                  value={resolution}
                  onChange={(e) => handleResolutionChange(e.target.value as AssetResolution)}
                  className="input"
                >
                  {RESOLUTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="input-cnt">
              <label className="label">
                <span>Output format</span>
                <select
                  value={format.type}
                  onChange={(e) => handleFormatTypeChange(e.target.value as FormatType)}
                  className="input"
                >
                  {FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {hasQuality(format) && (
              <div className="input-cnt">
                <label className="label">
                  <span>Quality</span>
                  <select
                    value={format.quality}
                    onChange={(e) => handleQualityChange(Number(e.target.value))}
                    className="input"
                  >
                    {QUALITIES.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          <div className="input-cnt flex flex-row gap-2 mt-2">
            <label className="label-row flex items-center gap-2">
              <input
                type="checkbox"
                checked={maxSize !== null}
                onChange={(e) => handleMaxSizeToggle(e.target.checked)}
              />
              <span className="text-sm">Max size</span>
            </label>
            <div className="flex flex-1 gap-2 items-center">
              <input
                type="number"
                min={1}
                step={1}
                disabled={maxSize === null}
                value={maxSize === null ? (displayDims?.width ?? '') : maxWidthInput}
                onChange={(e) => setMaxWidthInput(e.target.value)}
                onBlur={commitMaxSize}
                className="input disabled:bg-gray-300 disabled:opacity-30"
              />
              <span className="text-gray-400">×</span>
              <input
                type="number"
                min={1}
                step={1}
                disabled={maxSize === null}
                value={maxSize === null ? (displayDims?.height ?? '') : maxHeightInput}
                onChange={(e) => setMaxHeightInput(e.target.value)}
                onBlur={commitMaxSize}
                className="input disabled:bg-gray-300 disabled:opacity-30"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
