'use client'

import { type FC, useEffect, useState } from 'react'
import type { BlockData, BlockTypeImage } from '#cms/lib/blocks/declarations.ts'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import { getAssetUrl } from '#cms/lib/getAssetUrl.ts'
import { formatSize } from '#cms/utils/formatSize.ts'
import { X } from '#cms/components/icons.tsx'
import { useCMSLocales } from '#cms/components/CMSLocalesProvider/CMSLocalesProvider.tsx'
import { LocaleSwitch } from '#cms/screens/Manage/LocaleSwitch.tsx'
import { MetaView } from '../Meta/MetaView.tsx'

type BlockCardProps = {
  block: BlockData
  translations: Translations
  assetSizes: Record<string, number>
  onEdit: () => void
  onRemove: () => void
}

const contentTypeLabels = { plain: 'Plain', markdown: 'Markdown', html: 'HTML' }

// A text in the language shown: its translation, or, missing one, its own text,
// which shows greyed
type Localize = (translationKey: string, text: string) => { text: string; missing: boolean }

// The block's texts that have translations: a text block's text, an image's alt,
// and its translatable attributes, each by its key, with its own text.
const translatableTexts = (block: BlockData) => {
  const { content } = block
  const texts: { key: string; text: string }[] = []
  if (content.type === 'text') {
    texts.push({ key: 'block:' + block.id + ':text', text: content.text })
  }
  if (content.type === 'image') {
    texts.push({ key: 'block:' + block.id + ':alt', text: content.alt })
  }
  for (const attr of block.attributes) {
    if (attr.translatable) texts.push({ key: 'attribute:' + attr.id + ':text', text: attr.text })
  }
  return texts
}

// A block to read, in brief: its type and key, its content, and its attributes. A
// click on it, or Edit, opens it for editing. With more than one language, and a
// text that has translations, a switch shows the block in another language.
export const BlockCard: FC<BlockCardProps> = ({
  block,
  translations,
  assetSizes,
  onEdit,
  onRemove,
}) => {
  const [removing, setRemoving] = useState(false)
  const { locales, default: defaultLocale } = useCMSLocales()
  const [locale, setLocale] = useState(defaultLocale)
  const { content } = block

  const texts = translatableTexts(block)
  const isFilled = (code: string) =>
    code === defaultLocale || texts.every((t) => !t.text || !!translations[code]?.[t.key])
  const localize: Localize = (key, text) => {
    const translation = locale === defaultLocale ? text : translations[locale]?.[key]
    return translation ? { text: translation, missing: false } : { text, missing: !!text }
  }

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
        {locales.length > 1 && texts.length > 0 && (
          <div className="-my-2">
            <LocaleSwitch active={locale} onChange={setLocale} isFilled={isFilled} />
          </div>
        )}
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
      <BlockSummary block={block} assetSizes={assetSizes} localize={localize} />
      {block.attributes.length > 0 && (
        <MetaView attributes={block.attributes} translations={translations} locale={locale} />
      )}
    </div>
  )
}

const BlockSummary: FC<{
  block: BlockData
  assetSizes: Record<string, number>
  localize: Localize
}> = ({ block, assetSizes, localize }) => {
  const { content } = block
  if (content.type === 'text' || content.type === 'meta') {
    const { text, missing } =
      content.type === 'text'
        ? localize('block:' + block.id + ':text', content.text)
        : { text: content.text, missing: false }
    return text ? (
      <p
        className={`line-clamp-3 whitespace-pre-line text-sm ${missing ? 'text-gray-400' : 'text-gray-700'}`}
      >
        {text}
      </p>
    ) : (
      <span className="text-sm italic text-gray-400">Empty</span>
    )
  }
  if (content.type === 'image') {
    return (
      <ImageSummary content={content} alt={localize('block:' + block.id + ':alt', content.alt)} />
    )
  }
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
const ImageSummary: FC<{ content: BlockTypeImage; alt: ReturnType<Localize> }> = ({
  content,
  alt,
}) => {
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
        {alt.text && (
          <span className={`truncate ${alt.missing ? 'text-gray-300' : 'text-gray-500'}`}>
            {alt.text}
          </span>
        )}
      </div>
    </div>
  )
}
