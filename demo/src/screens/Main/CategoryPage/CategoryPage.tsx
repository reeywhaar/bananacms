import { cache } from 'react'
import { Metadata, ResolvingMetadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { v4 } from 'uuid'
import {
  BlockData,
  BlockTypeImage,
  getImagesMetadata,
  getOptimizedAssetSrcSet,
  getServices,
} from '@reeywhaar/bananacms/runtime'
import { AssetStore, BlockStore, CategoryStore, PostStore } from '@reeywhaar/bananacms/stores'
import { WithBreadcrumbs } from '@app/components/Breadcrumbs/Breadcrumbs'
import { WithNewLines } from '@app/components/WithNewLines/WithNewLines'
import { secFontTitle } from '@app/lib/fonts'
import Footer from '../Footer'
import { routing } from '../routing'

type Props = {
  params: Promise<{ id: string; slug?: string }>
  searchParams: URLSearchParams
}

const getData = cache(async ({ params }: Props) => {
  const locale = (await getLocale()) as 'en'
  const services = await getServices()
  const categoryStore = new CategoryStore(services.db)
  const postStore = new PostStore(services.db)
  const blockStore = new BlockStore(services.db)
  const p = await params
  const id = p.id
  const section = await categoryStore.getPublicByShortId(locale, id)
  if (!section) notFound()
  if (section.slug !== p.slug) redirect(routing.category(section.shortid, section.slug))
  const posts = await postStore.getPublicByCategoryId(
    locale,
    section.id,
    services.authData.loggedIn ? undefined : true,
  )
  if (!posts.length) notFound()
  const blocks = await blockStore.getPublicByParentIds(
    locale,
    'post',
    posts.map((p) => p.id),
  )
  const postsWithBlocks = posts.map((post) => ({
    ...post,
    blocks: blocks[post.id] ?? [],
  }))

  return {
    section,
    posts: postsWithBlocks,
  }
})

export async function generateMetadata(
  { params, searchParams }: Props,
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { section } = await getData({ params, searchParams })

  return {
    title: section.name,
  }
}

export default async function Page({ params }: Props) {
  const { section, posts } = await getData({ params, searchParams: new URLSearchParams() })
  const imageBlocks = posts.flatMap((post) =>
    post.blocks.flatMap(function matcher(block): BlockTypeImage[] {
      if (block.content.type === 'image') return [block.content]
      if (block.content.type === 'group') {
        return block.content.blocks.flatMap(matcher)
      }
      return []
    }),
  )

  const imageAssetIds = imageBlocks.map((b) => b.assetId)
  const imageMetadata = await getImagesMetadata(imageAssetIds)
  const services = await getServices()
  const assetContents = imageAssetIds.length
    ? await new AssetStore(services.db).getContent(imageAssetIds)
    : {}

  const renderBlock =
    // eslint-disable-next-line react/display-name
    (ctx: Context) => (block: BlockData, _index: number, _group: BlockData[]) => {
      switch (block.content.type) {
        case 'group': {
          const key = block.content.key
          const mode = (() => {
            switch (true) {
              case key.includes('image-row-xl'):
                return 'row-xl'
              case key.includes('image-row'):
                return 'row-normal'
              case key.includes('image-row-sm'):
                return 'row-sm'
              case key.includes('image-col'):
                return 'col-sm'
              default:
                return null
            }
          })()

          const className = (() => {
            switch (mode) {
              case 'row-xl':
                return 'flex-row h-[70vh] overflow-x-auto w-full justify-between'
              case 'row-normal':
                return 'flex-row h-[50vh] overflow-x-auto w-full justify-between'
              case 'row-sm':
                return 'flex-row h-[35vh] overflow-x-auto w-full justify-between'
              case 'col-sm':
                return 'flex-col h-full flex-[1_0_75%] md:flex-[1_0_25%]'
              default:
                return ''
            }
          })()

          return (
            <div key={block.id} className={`flex ${className} gap-1 md:gap-2`}>
              {block.content.blocks.map(renderBlock(ctx.withValues([mode])))}
            </div>
          )
        }
        case 'text': {
          const minWidth = block.content.key
            .split(' ')
            .find((c) => c.startsWith('min-width-'))
            ?.replace('min-width-', '')
          const classes = block.content.key
            .split(' ')
            .filter((c) => c.startsWith('class-'))
            .map((c) => c.replace('class-', ''))
            .join(' ')

          return (
            <div key={block.id} style={{ minWidth }} className={`w-full ${classes}`}>
              <WithNewLines text={block.content.text} />
            </div>
          )
        }
        case 'image': {
          const mode = ctx.getValue((value) => {
            switch (value) {
              case 'row-xl':
              case 'row-normal':
              case 'row-sm':
              case 'col-sm':
                return { data: value }
              default:
                return null
            }
          })
          const className = (() => {
            switch (mode) {
              case 'row-xl':
              case 'row-normal':
              case 'row-sm':
                return 'flex-none h-full'
              case 'col-sm':
                return 'flex-1 w-full min-h-[1px] flex items-center justify-center'
              default:
                return ''
            }
          })()
          const metadata = imageMetadata[block.content.assetId]
          const assetContent = assetContents[block.content.assetId]
          const outputAs = assetContent?.output_as ?? { type: 'original' }
          const maxRes = assetContent?.resolution ?? '@1x'
          const maxSize = assetContent?.maxSize
          const { src, srcSet } = getOptimizedAssetSrcSet(
            block.content.assetId,
            outputAs,
            maxRes,
            maxSize,
          )
          return (
            <div key={block.id} className={className}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                width={metadata.width}
                height={metadata.height}
                loading="lazy"
                decoding="async"
                className="object-contain h-full w-auto"
                src={src}
                srcSet={srcSet}
                alt={block.content.alt}
              />
            </div>
          )
        }
        default:
          return null
      }
    }

  return (
    <WithBreadcrumbs
      items={[
        {
          name: section.name.split('/').at(0) ?? '',
        },
      ]}
    >
      <>
        <main className="p-2 md:p-4 flex flex-col gap-8">
          <h1 className={`text-2xl ${secFontTitle}`}>{section.name}</h1>
          {posts.map((post) => {
            const postParts = post.name.split('/')
            const postMain = postParts[0]
            const postSub = postParts.slice(1)
            return (
              <div key={post.id}>
                <div className="flex flex-col mb-4">
                  <h2 className="text-xl">
                    {postMain}{' '}
                    {post.status !== 'published' ? (
                      <span className="capitalize text-sm rounded bg-yellow-200 ml-2 px-2 py-0.5 align-[3px]">
                        {post.status}
                      </span>
                    ) : (
                      ''
                    )}
                  </h2>
                  {postSub.map((p, i) => (
                    <h3 key={i} className="text-base text-gray-700 italic">
                      {p}
                    </h3>
                  ))}
                </div>
                <div className="flex flex-col items-start gap-4">
                  {post.blocks.map(renderBlock(new Context()))}
                </div>
              </div>
            )
          })}
        </main>
        <Footer />
      </>
    </WithBreadcrumbs>
  )
}

class Context {
  readonly id: string
  readonly parent: Context | null
  readonly values: unknown[]

  constructor(parent: Context | null = null, values: unknown[] = []) {
    this.id = v4()
    this.parent = parent
    this.values = values
  }

  withValues<T extends unknown[]>(values: T): Context {
    const ctx = new Context(this, values)
    return ctx
  }

  getValue<T>(matcher: (value: unknown) => { data: T } | null): T | null {
    try {
      for (const value of this.values) {
        const match = matcher(value)
        if (match) return match.data
      }
    } catch {}
    return null
  }

  getMatchingValue<T>(predicate: (value: unknown) => value is T): T | null {
    try {
      for (const value of this.values) {
        if (predicate(value)) return value
      }
    } catch {}
    if (this.parent) return this.parent.getMatchingValue(predicate)
    return null
  }
}
