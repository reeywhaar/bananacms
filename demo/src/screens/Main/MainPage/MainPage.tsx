import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { getServices } from '@reeywhaar/bananacms/runtime'
import { BlockStore, PageStore } from '@reeywhaar/bananacms/stores'
import { contacts } from '@app/lib/contacts'
import { secFontTitle } from '@app/lib/fonts'
import Footer from '../Footer'
import { findAndMap } from '@app/utils/findAndMap'

export default async function MainPage() {
  const services = await getServices()
  const t = await getTranslations('main')
  const pageStore = new PageStore(services.db)
  const blockStore = new BlockStore(services.db)
  const page = await pageStore.getByKey('Main Page')
  if (!page) notFound()
  const blocks = (await blockStore.getPublicByParentIds('ru', 'page', [page.id]))[page.id]
  const descriptionBlock = findAndMap(blocks, (b) =>
    b.content.type === 'text' && b.content.key === 'description' ? { data: b.content } : null,
  )

  return (
    <>
      <main className="flex flex-col">
        <div className="relative flex-1 overflow-hidden">
          <div className="flex flex-col items-start justify-start">
            <div className="w-full inline-flex flex-col md:flex-row items-start md:items-end justify-between p-4 gap-8">
              <div className="flex flex-col">
                <h1 className={`text-2xl md:text-4xl font-normal max-md:w-full ${secFontTitle}`}>
                  {t('name')}
                </h1>
              </div>
              <div className="flex flex-col md:items-end">
                {contacts.map((c) => (
                  <div key={c.id} className="font-light text-sm md:text-base max-md:w-full">
                    <a
                      href={c.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="interactive"
                    >
                      <span className="text-xs">{c.name}: </span>
                      <span>{c.value}</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
            <h2 className="font-light text-sm md:text-base max-md:w-full flex flex-col gap-0.5">
              {descriptionBlock && (
                <div className="bg-white inline-flex flex-row items-center justify-center p-4 py-12 gap-4 rounded-[1px]">
                  <hr className="min-w-[10%] border-t-[0.5px] border-black/20 b flex-[0_1_10%]" />
                  <h1 className="text-base font-thin text-center italic text-black/80">
                    {descriptionBlock.text}
                  </h1>
                  <hr className="min-w-[10%] border-t-[0.5px] border-black/20 flex-1" />
                </div>
              )}
            </h2>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
