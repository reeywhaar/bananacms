'use client'

import { useRouter } from '../../../../framework/navigation.ts'
import { type FC, useState } from 'react'
import { useToast } from '../../../../components/Toast/Toast.tsx'
import { useEvent } from '../../../../hooks/useEvent.ts'
import type { PageData } from '../../../../services/PageStore.ts'
import { useWithProgress } from '../../../../components/ProgressOverlay/ProgressOverlay.tsx'
import type { Translations } from '../../../../services/LocalizationStore.ts'
import type { AttributeData } from '../../../../services/AttributeStore.ts'
import { BlockEditor } from '../BlockEditor/BlockEditor.tsx'
import { AttributesEditor } from '../AttributesEditor/AttributesEditor.tsx'
import { resolveBlocks, preventFileNavigation } from '../BlockEditor/resolveBlocks.ts'
import { addPage, editPage, deletePage } from './utils.ts'
import { routing } from '../../routing.ts'
import { extractErrorMessage } from '../../../../utils/extractErrorMessage.ts'
import { v7 } from 'uuid'
import type { BlockData } from '../../../../lib/blocks/declarations.ts'
import type { AssetContent } from '../../../../services/AssetStore.ts'
import { handleServerResult } from '../../../../lib/serverActions.ts'

export const Client: FC<{
  page?: PageData
  blocks?: BlockData[]
  initialAttributes?: AttributeData[]
  translations?: Translations
  assetContents?: Record<string, AssetContent>
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
