import type { BlockData } from '@reeywhaar/bananacms'
import { marked } from 'marked'
import { type Assets, type ImageBlock } from '@app/lib/content.ts'
import { t } from '@app/lib/i18n.ts'
import { Picture } from './Picture.tsx'

// typography for text from the CMS: markdown's and HTML's elements
export const prose =
  'space-y-2 leading-relaxed [&_em]:italic [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5'

// Blocks as a post's page shows them: text as its content type says, images with
// their credits, galleries, files to download and links. A block whose key has a
// label (i18n.ts) gets it as its heading.
export function Blocks(props: { blocks: BlockData[]; assets: Assets; locale: string }) {
  return props.blocks.map((block) => (
    <BlockView key={block.id} block={block} assets={props.assets} locale={props.locale} />
  ))
}

function BlockView(props: { block: BlockData; assets: Assets; locale: string }) {
  const { block, assets, locale } = props
  const strings = t(locale)
  const label = strings.labels[block.content.key as keyof typeof strings.labels]
  const heading = label && <h2 className="mb-2 text-lg font-semibold">{label}</h2>

  switch (block.content.type) {
    case 'text': {
      const { contentType, text } = block.content
      const body =
        contentType === 'plain' ? (
          <p className="leading-relaxed whitespace-pre-line">{text}</p>
        ) : (
          <div
            className={prose}
            dangerouslySetInnerHTML={{
              __html: contentType === 'markdown' ? marked.parse(text, { async: false }) : text,
            }}
          />
        )
      return (
        <section
          className={block.content.key === 'tip' ? 'rounded-xl bg-amber-100/70 p-4' : undefined}
        >
          {heading}
          {body}
        </section>
      )
    }
    case 'image':
      return (
        <Picture
          block={block as ImageBlock}
          source={assets.images.get(block.content.assetId)}
          locale={locale}
        />
      )
    case 'asset': {
      const file = assets.files.get(block.content.assetId)
      if (!file) return null
      return (
        <p>
          <a
            href={file.url}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm hover:bg-amber-100"
          >
            ↓ {block.content.name}
            {file.size !== undefined && (
              <span className="text-stone-400">{Math.max(1, Math.round(file.size / 1024))} KB</span>
            )}
          </a>
        </p>
      )
    }
    case 'meta': {
      const { text } = block.content
      if (!/^https?:\/\//.test(text)) return <p className="text-sm text-stone-500">{text}</p>
      return (
        <p>
          <a href={text} className="text-amber-700 underline underline-offset-2" rel="noreferrer">
            {label ?? text} ↗
          </a>
        </p>
      )
    }
    case 'group':
      if (block.content.key === 'gallery') {
        return (
          <section>
            {heading}
            <div className="grid gap-4 sm:grid-cols-2">
              <Blocks blocks={block.content.blocks} assets={assets} locale={locale} />
            </div>
          </section>
        )
      }
      return (
        <div className="space-y-4">
          <Blocks blocks={block.content.blocks} assets={assets} locale={locale} />
        </div>
      )
  }
}
