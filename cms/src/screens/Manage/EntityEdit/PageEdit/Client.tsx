'use client'

import { useRouter } from '#cms/framework/navigation.ts'
import { type FC, useState } from 'react'
import { useToast } from '#cms/components/Toast/Toast.tsx'
import { useEvent } from '#cms/hooks/useEvent.ts'
import type { PageData } from '#cms/services/PageStore.ts'
import { useWithProgress } from '#cms/components/ProgressOverlay/ProgressOverlay.tsx'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import type { AttributeData } from '#cms/services/AttributeStore.ts'
import { BlockEditor } from '../BlockEditor/BlockEditor.tsx'
import { AttributesSection } from '../Meta/AttributesSection.tsx'
import { resolveBlocks, preventFileNavigation } from '../BlockEditor/resolveBlocks.ts'
import { addPage, editPage, deletePage } from './utils.ts'
import { routing } from '#cms/screens/Manage/routing.ts'
import { extractErrorMessage } from '#cms/utils/extractErrorMessage.ts'
import { v7 } from 'uuid'
import type { BlockData } from '#cms/lib/blocks/declarations.ts'
import type { AssetContent } from '#cms/services/AssetStore.ts'
import { handleServerResult } from '#cms/lib/serverActions.ts'
import { useCMSLocales } from '#cms/components/CMSLocalesProvider/CMSLocalesProvider.tsx'
import { copyContent } from '../copyContent.ts'

export const Client: FC<{
  page?: PageData
  // A page a new one starts as a copy of: its key, and the blocks, attributes and
  // translations given, which are its, under ids of the new page's own
  copyOf?: PageData
  blocks?: BlockData[]
  initialAttributes?: AttributeData[]
  translations?: Translations
  assetContents?: Record<string, AssetContent>
  assetSizes?: Record<string, number>
  assetMimes?: Record<string, string>
}> = ({
  page,
  copyOf,
  blocks: initialBlocks = [],
  initialAttributes = [],
  translations: initialTranslations,
  assetContents = {},
  assetSizes = {},
  assetMimes = {},
}) => {
  const router = useRouter()
  const [entityId] = useState(() => page?.id ?? v7())
  const { default: defaultLocale } = useCMSLocales()
  const [copy] = useState(() =>
    copyOf
      ? copyContent(
          {
            table: 'page',
            id: copyOf.id,
            blocks: initialBlocks,
            attributes: initialAttributes,
            translations: initialTranslations ?? {},
          },
          entityId,
          defaultLocale,
        )
      : undefined,
  )
  const [key, setKey] = useState((page ?? copyOf)?.key || '')
  const [blocks, setBlocks] = useState<BlockData[]>(copy?.blocks ?? initialBlocks)
  const [attributes, setAttributes] = useState<AttributeData[]>(
    copy?.attributes ?? initialAttributes,
  )
  const [translations, setTranslations] = useState<Translations>(
    copy?.translations ?? initialTranslations ?? {},
  )
  const withProgress = useWithProgress()
  const showToast = useToast()

  const handleSave = useEvent(async () => {
    await withProgress(async () => {
      try {
        const resolvedBlocks = await resolveBlocks(blocks)
        const payload = { key, blocks: resolvedBlocks, translations, attributes }
        if (page) {
          handleServerResult(await editPage(page.id, payload))
          setBlocks(resolvedBlocks)
          router.refresh()
          showToast('info', 'Saved!', { timeout: 1000 })
        } else {
          handleServerResult(await addPage(entityId, payload))
          showToast('info', 'Saved!', { timeout: 1000 })
          router.replace(routing.entityEdit('page', entityId))
        }
      } catch (e) {
        showToast('error', extractErrorMessage(e), { timeout: 3000 })
      }
    })
  })

  const handleDelete = useEvent(async () => {
    if (!page) return
    if (!window.confirm('Delete this page? This cannot be undone.')) return
    await withProgress(async () => {
      handleServerResult(await deletePage(page.id))
      router.replace(routing.manage)
    })
  })

  return (
    <form
      action={handleSave}
      className="p-4 flex flex-col gap-4 items-start"
      onDragOver={preventFileNavigation}
      onDrop={preventFileNavigation}
    >
      <div className="input-cnt">
        <label className="label">
          <span>Key</span>
          <input value={key} onChange={(e) => setKey(e.target.value)} className="input-xl" />
        </label>
      </div>
      <AttributesSection
        attributes={attributes}
        onChange={setAttributes}
        translations={translations}
        onTranslationsChange={setTranslations}
      />
      <div className="h-4" />
      <BlockEditor
        blocks={blocks}
        onChange={setBlocks}
        translations={translations}
        onTranslationsChange={setTranslations}
        assetContents={assetContents}
        assetSizes={assetSizes}
        assetMimes={assetMimes}
      />
      <div className="h-12" />
      {/* at the bottom of the screen, however short the page, the spacer above
          keeping what's last on it clear */}
      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-end gap-3 border-t border-gray-200 bg-white px-4 py-3">
        {page && (
          <button type="button" className="button-danger" onClick={handleDelete}>
            Delete
          </button>
        )}
        <button className="button">Save</button>
      </div>
    </form>
  )
}
