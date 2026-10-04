'use client'

import { type FC, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import type { BlockData, BlockTypeAsset, BlockTypeImage } from '#cms/lib/blocks/declarations.ts'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import type {
  AssetContent,
  AssetImageContent,
  AssetOutputFormat,
} from '#cms/services/AssetStore.ts'
import { getAssetUrl } from '#cms/lib/getAssetUrl.ts'
import { formatChannels, formatDuration, formatSampleRate } from '#cms/lib/audioMeta.ts'
import { formatSize } from '#cms/utils/formatSize.ts'
import { X } from '#cms/components/icons.tsx'
import { useCMSLocales } from '#cms/components/CMSLocalesProvider/CMSLocalesProvider.tsx'
import { LocaleSwitch } from '#cms/screens/Manage/LocaleSwitch.tsx'
import { LocaleStatus } from '#cms/screens/Manage/LocaleStatus.tsx'
import { MetaView } from '../Meta/MetaView.tsx'

type BlockCardProps = {
  block: BlockData
  translations: Translations
  assetContents: Record<string, AssetContent>
  assetSizes: Record<string, number>
  assetMimes: Record<string, string>
  onEdit: () => void
  onRemove: () => void
}

const contentTypeLabels = { plain: 'Plain', markdown: 'Markdown', html: 'HTML' }

const formatLabels: Record<AssetOutputFormat['type'], string> = {
  original: 'Original',
  gif: 'GIF',
  png8: 'PNG-8',
  png24: 'PNG-24',
  jpeg: 'JPEG',
  webp: 'WebP',
}

const formatLabel = (format: AssetOutputFormat) =>
  'quality' in format
    ? `${formatLabels[format.type]}, quality ${format.quality}`
    : formatLabels[format.type]

// typography for a text block's markdown and HTML, which the reset strips
const prose =
  'space-y-1 [&_a]:underline [&_code]:font-mono [&_em]:italic [&_h1,&_h2,&_h3,&_h4,&_h5,&_h6]:font-semibold [&_img]:max-h-24 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5'

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
  assetContents,
  assetSizes,
  assetMimes,
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
          <LocaleSwitch active={locale} onChange={setLocale} isFilled={isFilled} />
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
          className="button-sm-plain"
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
      <BlockSummary
        block={block}
        translations={translations}
        assetContents={assetContents}
        assetSizes={assetSizes}
        assetMimes={assetMimes}
        localize={localize}
      />
      {block.attributes.length > 0 && (
        <MetaView attributes={block.attributes} translations={translations} locale={locale} />
      )}
    </div>
  )
}

const BlockSummary: FC<{
  block: BlockData
  translations: Translations
  assetContents: Record<string, AssetContent>
  assetSizes: Record<string, number>
  assetMimes: Record<string, string>
  localize: Localize
}> = ({ block, translations, assetContents, assetSizes, assetMimes, localize }) => {
  const { locales } = useCMSLocales()
  const withStatus = locales.length > 1
  const { content } = block
  if (content.type === 'text') {
    const key = 'block:' + block.id + ':text'
    const { text, missing } = localize(key, content.text)
    const contentType = content.contentType ?? 'plain'
    return (
      <div className="flex min-w-0 items-start gap-3">
        {withStatus && (
          <span className="flex h-5 shrink-0 items-center">
            <LocaleStatus text={content.text} translationKey={key} translations={translations} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {!text || contentType === 'plain' ? (
            <PlainSummary text={text} missing={missing} />
          ) : (
            <RenderedSummary
              html={contentType === 'markdown' ? marked.parse(text, { async: false }) : text}
              missing={missing}
            />
          )}
        </div>
      </div>
    )
  }
  if (content.type === 'meta') return <PlainSummary text={content.text} missing={false} />
  if (content.type === 'image') {
    const assetContent = assetContents[content.assetId]
    return (
      <ImageSummary
        block={block as BlockData & { content: BlockTypeImage }}
        alt={localize('block:' + block.id + ':alt', content.alt)}
        assetContent={assetContent?.type === 'image' ? assetContent : null}
        size={assetSizes[content.assetId]}
        mime={assetMimes[content.assetId]}
        translations={translations}
        withStatus={withStatus}
      />
    )
  }
  if (content.type === 'asset') {
    return (
      <AssetSummary
        content={content}
        assetContent={assetContents[content.assetId] ?? null}
        size={assetSizes[content.assetId]}
        mime={assetMimes[content.assetId]}
      />
    )
  }
  return null
}

// A file's details: its name, type and size, and what an audio file declares of
// itself, read from it at upload, so a new one has none of that yet. A saved audio
// file plays in the card. The details are in groups side by side, the file's, the
// tags' and the sound's, which go under one another where there's no room.
const AssetSummary: FC<{
  content: BlockTypeAsset
  assetContent: AssetContent | null
  size: number | undefined
  mime: string | undefined
}> = ({ content, assetContent, size, mime }) => {
  const file = content.pendingFile
  const name = file?.name ?? content.name
  if (!name) return <span className="text-sm italic text-gray-400">No file</span>
  const type = file ? file.type : mime
  const bytes = file ? file.size : size
  const audio = !file && assetContent?.type === 'audio' ? assetContent : null
  const tags = audio?.tags
  const hasTags = !!(tags?.title || tags?.artist || tags?.album || tags?.year)
  const hasSound =
    audio?.duration !== undefined ||
    audio?.bitrate !== undefined ||
    audio?.sampleRate !== undefined ||
    audio?.channels !== undefined

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {audio && content.assetId && <AudioPlayer src={getAssetUrl(content.assetId)} />}
      <div className="flex min-w-0 flex-wrap gap-x-10 gap-y-3">
        <DetailGroup>
          <Detail label="File">{name}</Detail>
          {type && <Detail label="Type">{type}</Detail>}
          {bytes != null && <Detail label="Size">{formatSize(bytes)}</Detail>}
        </DetailGroup>
        {hasTags && (
          <DetailGroup>
            {tags?.title && <Detail label="Title">{tags.title}</Detail>}
            {tags?.artist && <Detail label="Artist">{tags.artist}</Detail>}
            {tags?.album && <Detail label="Album">{tags.album}</Detail>}
            {tags?.year && <Detail label="Year">{tags.year}</Detail>}
          </DetailGroup>
        )}
        {hasSound && (
          <DetailGroup>
            {audio?.duration !== undefined && (
              <Detail label="Duration">{formatDuration(audio.duration)}</Detail>
            )}
            {audio?.bitrate !== undefined && (
              <Detail label="Bitrate">{Math.round(audio.bitrate / 1000)} kbps</Detail>
            )}
            {audio?.sampleRate !== undefined && (
              <Detail label="Sample rate">{formatSampleRate(audio.sampleRate)}</Detail>
            )}
            {audio?.channels !== undefined && (
              <Detail label="Channels">{formatChannels(audio.channels)}</Detail>
            )}
          </DetailGroup>
        )}
      </div>
    </div>
  )
}

const DetailGroup: FC<{ children: ReactNode }> = ({ children }) => (
  <dl className="grid min-w-0 grid-cols-[minmax(0,max-content)_minmax(0,1fr)] content-start gap-x-4 gap-y-1 text-sm">
    {children}
  </dl>
)

// The browser's player, which loads nothing until it's played. A click on it is
// the player's, rather than the card's, which would open the block.
const AudioPlayer: FC<{ src: string }> = ({ src }) => (
  <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
    <audio controls preload="none" src={src} className="h-10 w-full" />
  </div>
)

// The text's spaces and line breaks show as written, like a meta block's indented
// JSON. A word too long for the card, like a URL, breaks where it has to, rather
// than being cut off at its edge. So does one in RenderedSummary.
const PlainSummary: FC<{ text: string; missing: boolean }> = ({ text, missing }) =>
  text ? (
    <p
      className={`line-clamp-3 whitespace-pre-wrap wrap-anywhere text-sm ${missing ? 'text-gray-400' : 'text-gray-700'}`}
    >
      {text}
    </p>
  ) : (
    <span className="text-sm italic text-gray-400">Empty</span>
  )

// Markdown's HTML, or a block's own, rendered, and made whole first in a <template>:
// a stray end tag, or one left open, stays in the card. There's no <template> on
// the server, so it shows once the page is in the browser. A click on a link in
// it is the card's, rather than one leaving the page.
const RenderedSummary: FC<{ html: string; missing: boolean }> = ({ html, missing }) => {
  const [whole, setWhole] = useState<string | null>(null)

  useLayoutEffect(() => {
    const template = document.createElement('template')
    template.innerHTML = html
    setWhole(template.innerHTML)
  }, [html])

  if (whole === null) return null
  return (
    <div
      className={`pointer-events-none line-clamp-3 wrap-anywhere text-sm ${prose} ${missing ? 'text-gray-400' : 'text-gray-700'}`}
      dangerouslySetInnerHTML={{ __html: whole }}
    />
  )
}

// A new image's file shows through an object URL, and a saved one from its asset,
// whole in a box of its own, with its details beside it: those of the file, and
// the settings of the image the site shows, a new image's as the dialog set them.
const ImageSummary: FC<{
  block: BlockData & { content: BlockTypeImage }
  alt: ReturnType<Localize>
  assetContent: AssetImageContent | null
  size: number | undefined
  mime: string | undefined
  translations: Translations
  withStatus: boolean
}> = ({ block, alt, assetContent, size, mime, translations, withStatus }) => {
  const { content } = block
  const file = content.pendingFile
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  // the file's own size, which a saved image's content has too, unless it's old
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null)
  const img = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const src = file ? objectUrl : content.assetId && getAssetUrl(content.assetId)

  // one loaded before the page was hydrated has had its load event already
  useEffect(() => {
    const el = img.current
    if (el?.complete && el.naturalWidth) {
      setNatural({ width: el.naturalWidth, height: el.naturalHeight })
    }
  }, [src])

  const settings = file
    ? {
        resolution: content.pendingResolution,
        outputAs: content.pendingOutputAs,
        maxSize: content.pendingMaxSize,
      }
    : {
        resolution: assetContent?.resolution,
        outputAs: assetContent?.output_as,
        maxSize: assetContent?.maxSize,
      }
  const dimensions =
    !file && assetContent?.width && assetContent.height
      ? { width: assetContent.width, height: assetContent.height }
      : natural
  const type = file ? file.type : mime
  const bytes = file ? file.size : size
  const name = file?.name ?? content.name

  return (
    // on a phone, the details go under the image, having no room beside it
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex h-50 w-full shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-100 p-3 sm:w-50">
        {src ? (
          <img
            ref={img}
            src={src}
            alt={content.alt}
            className="size-full object-contain"
            onLoad={(e) =>
              setNatural({
                width: e.currentTarget.naturalWidth,
                height: e.currentTarget.naturalHeight,
              })
            }
          />
        ) : (
          <span className="text-xs text-gray-400">No image</span>
        )}
      </div>
      <dl className="grid min-w-0 flex-1 grid-cols-[minmax(0,max-content)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
        {name && <Detail label="File">{name}</Detail>}
        <Detail
          label="Alt"
          status={
            withStatus && (
              <LocaleStatus
                text={content.alt}
                translationKey={'block:' + block.id + ':alt'}
                translations={translations}
              />
            )
          }
        >
          <span className={alt.text && !alt.missing ? '' : 'text-gray-400'}>{alt.text || '—'}</span>
        </Detail>
        {type && <Detail label="Type">{type}</Detail>}
        {dimensions && (
          <Detail label="Dimensions">
            {dimensions.width} × {dimensions.height}
          </Detail>
        )}
        {bytes != null && <Detail label="Size">{formatSize(bytes)}</Detail>}
        <Detail label="Resolution">{settings.resolution ?? '@1x'}</Detail>
        <Detail label="Output">
          {settings.outputAs ? formatLabel(settings.outputAs) : 'Original'}
        </Detail>
        {settings.maxSize && (
          <Detail label="Max size">
            {settings.maxSize.width} × {settings.maxSize.height}
          </Detail>
        )}
      </dl>
    </div>
  )
}

const Detail: FC<{
  label: string
  // the languages of a translatable detail, after its label
  status?: ReactNode
  children: ReactNode
}> = ({ label, status, children }) => (
  <>
    <dt className="wrap-anywhere text-gray-500">
      {label}
      {status && <span className="ml-1.5">{status}</span>}
    </dt>
    <dd className="wrap-anywhere text-gray-800">{children}</dd>
  </>
)
