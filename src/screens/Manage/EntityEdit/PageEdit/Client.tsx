'use client'

import { useRouter } from 'next/navigation'
import { FC, useState } from 'react'
import { useToast } from '@cms/components/Toast/Toast'
import { useEvent } from '@cms/hooks/useEvent'
import { PageData } from '@cms/services/PageStore'
import { useWithProgress } from '@cms/components/ProgressOverlay/ProgressOverlay'
import { Translations } from '@cms/services/LocalizationStore'
import { AttributeData } from '@cms/services/AttributeStore'
import { BlockEditor } from '../BlockEditor/BlockEditor'
import { AttributesEditor } from '../AttributesEditor/AttributesEditor'
import { resolveBlocks, preventFileNavigation } from '../BlockEditor/resolveBlocks'
import { addPage, editPage, deletePage } from './utils'
import { routing } from '../../routing'
import { extractErrorMessage } from '@cms/utils/extractErrorMessage'
import { v7 } from 'uuid'
import { BlockData } from '@cms/lib/blocks/declarations'
import { AssetImageContent } from '@cms/services/AssetStore'
import { handleServerResult } from '@cms/lib/serverActions'

export const Client: FC<{
  page?: PageData
  blocks?: BlockData[]
  initialAttributes?: AttributeData[]
  translations?: Translations
  assetContents?: Record<string, AssetImageContent>
  assetSizes?: Record<string, number>
}> = ({
  page,
  blocks: initialBlocks = [],
  initialAttributes = [],
  translations: initialTranslations,
  assetContents = {},
  assetSizes = {},
}) => {
  const router = useRouter()
  const [entityId] = useState(() => page?.id ?? v7())
  const [key, setKey] = useState(page?.key || '')
  const [blocks, setBlocks] = useState<BlockData[]>(initialBlocks)
  const [attributes, setAttributes] = useState<AttributeData[]>(initialAttributes)
  const [translations, setTranslations] = useState<Translations>(initialTranslations ?? {})
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
      <AttributesEditor
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
      />
      <div className="h-8" />
      <div className="sticky bottom-0 -mx-4 -mb-4 flex w-full justify-end gap-3 border-t border-gray-200 bg-white px-4 py-3 box-content">
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
