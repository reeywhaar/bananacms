import { attributeOf, type ImageBlock, type ImageSource } from '@app/lib/content.ts'
import { t } from '@app/lib/i18n.ts'

// An image block as a figure: its variants for each pixel density, and the credit
// its attributes carry
export function Picture(props: {
  block: ImageBlock
  source: ImageSource | undefined
  locale: string
  className?: string
  imageClassName?: string
}) {
  const { block, source } = props
  if (!source) return null
  return (
    <figure className={props.className}>
      <img
        src={source.src}
        srcSet={source.srcSet}
        width={source.width}
        height={source.height}
        alt={block.content.alt}
        loading="lazy"
        decoding="async"
        className={`h-auto w-full rounded-xl bg-amber-100 ${props.imageClassName ?? ''}`}
      />
      <Credit block={block} locale={props.locale} />
    </figure>
  )
}

const link = 'underline decoration-stone-300 underline-offset-2 hover:text-stone-800'

// "Photo by … on Unsplash", with links to the photographer and the photo, as
// Unsplash asks; "…, public domain, via Wikimedia Commons" for the rest
export function Credit(props: { block: ImageBlock; locale: string }) {
  const author = attributeOf(props.block, 'credit')
  if (!author) return null
  const strings = t(props.locale)
  const authorUrl = attributeOf(props.block, 'creditUrl')
  const source = attributeOf(props.block, 'source') ?? ''
  const sourceUrl = attributeOf(props.block, 'sourceUrl')
  const linked = (href: string | undefined, text: string) =>
    href ? (
      <a href={href} className={link} rel="noreferrer">
        {text}
      </a>
    ) : (
      text
    )
  return (
    <figcaption className="mt-1.5 text-xs text-stone-500">
      {attributeOf(props.block, 'license') === 'Public domain' ? (
        <>
          {author}, {strings.publicDomain} {linked(sourceUrl, source)}
        </>
      ) : (
        <>
          {strings.photoBy} {linked(authorUrl, author)} {strings.on} {linked(sourceUrl, source)}
        </>
      )}
    </figcaption>
  )
}
