import type { BlockData } from '@reeywhaar/bananacms'
import type { PostData } from '@reeywhaar/bananacms/stores'
import { Link } from '@reeywhaar/bananacms/client'
import { pictureOf, textOf, type Assets } from '@app/lib/content.ts'
import { t } from '@app/lib/i18n.ts'

// A post in a list: its picture, its name and its summary
export function PostCard(props: {
  post: PostData
  href: string
  blocks: BlockData[]
  assets: Assets
  locale: string
}) {
  const picture = pictureOf(props.blocks)
  const image = picture && props.assets.images.get(picture.content.assetId)
  return (
    <Link
      href={props.href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm transition hover:shadow-md"
    >
      {picture && image && (
        <img
          src={image.src}
          srcSet={image.srcSet}
          width={image.width}
          height={image.height}
          alt={picture.content.alt}
          loading="lazy"
          decoding="async"
          className="aspect-[3/2] w-full bg-amber-100 object-cover"
        />
      )}
      <div className="p-4">
        <h3 className="font-semibold group-hover:text-amber-700">
          {props.post.name}
          {props.post.status === 'draft' && (
            <span className="ml-2 rounded bg-stone-200 px-1.5 py-0.5 text-xs font-normal text-stone-600">
              {t(props.locale).draft}
            </span>
          )}
        </h3>
        <p className="mt-1 line-clamp-3 text-sm text-stone-600">
          {textOf(props.blocks, 'summary')}
        </p>
      </div>
    </Link>
  )
}
