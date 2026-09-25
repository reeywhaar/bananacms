import type { Metadata, PageProps } from '@reeywhaar/bananacms'
import { Suspense } from 'react'
import { BlockSkeleton } from '@app/blocks/BlockSkeleton.tsx'
import { CategoriesBlock } from '@app/blocks/CategoriesBlock.tsx'
import { HeroBlock } from '@app/blocks/HeroBlock.tsx'
import { PollBlock } from '@app/blocks/PollBlock.tsx'
import { RipenessBlock } from '@app/blocks/RipenessBlock.tsx'
import { assetsOf, byKey, pageBlocks } from '@app/lib/content.ts'
import { t } from '@app/lib/i18n.ts'
import { languages, localeOf } from '@app/lib/locale.ts'

export const generateMetadata = (): Metadata => ({ alternates: { languages: languages('') } })

// The home page: its hero, poll and ripeness guide come from the CMS's "Main
// page", and the categories stream in with their first posts
export default async function HomePage(props: PageProps<{ locale: string }>) {
  const locale = await localeOf(props.params)
  const main = await pageBlocks(props.ctx, 'Main page', locale)
  if (!main) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
        {t(locale).noContent}
      </section>
    )
  }
  const assets = await assetsOf(props.ctx, main.blocks)
  return (
    <>
      <HeroBlock hero={byKey(main.blocks, 'hero')} assets={assets} locale={locale} />
      <Suspense fallback={<BlockSkeleton />}>
        <CategoriesBlock ctx={props.ctx} locale={locale} />
      </Suspense>
      <div className="grid gap-6 md:grid-cols-2">
        <PollBlock poll={byKey(main.blocks, 'poll')} locale={locale} />
        <RipenessBlock ripeness={byKey(main.blocks, 'ripeness')} label={t(locale).ripeness} />
      </div>
    </>
  )
}
