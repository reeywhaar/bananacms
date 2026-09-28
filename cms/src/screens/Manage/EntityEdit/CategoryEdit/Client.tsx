'use client'

import type { CategoryData } from '#cms/services/CategoryStore.ts'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import type { AttributeData } from '#cms/services/AttributeStore.ts'
import { useRouter } from '#cms/framework/navigation.ts'
import { LocalizableField } from '#cms/screens/Manage/LocalizableField.tsx'
import { type FC, useState } from 'react'
import { addCategory, editCategory, deleteCategory } from './utils.ts'
import { BlockEditor } from '../BlockEditor/BlockEditor.tsx'
import { AttributesSection } from '../Meta/AttributesSection.tsx'
import { resolveBlocks, preventFileNavigation } from '../BlockEditor/resolveBlocks.ts'
import { routing } from '#cms/screens/Manage/routing.ts'
import { useToast } from '#cms/components/Toast/Toast.tsx'
import { useConfirm } from '#cms/components/Confirm/Confirm.tsx'
import { useEvent } from '#cms/hooks/useEvent.ts'
import { useWithProgress } from '#cms/components/ProgressOverlay/ProgressOverlay.tsx'
import { extractErrorMessage } from '#cms/utils/extractErrorMessage.ts'
import type { BlockData } from '#cms/lib/blocks/declarations.ts'
import type { AssetContent } from '#cms/services/AssetStore.ts'
import { v7 } from 'uuid'
import { handleServerResult } from '#cms/lib/serverActions.ts'

export const Client: FC<{
  category?: CategoryData
  blocks?: BlockData[]
  initialAttributes?: AttributeData[]
  translations?: Translations
  assetContents?: Record<string, AssetContent>
  assetSizes?: Record<string, number>
  assetMimes?: Record<string, string>
}> = ({
  category,
  blocks: initialBlocks = [],
  initialAttributes = [],
  translations: initialTranslations,
  assetContents = {},
  assetSizes = {},
  assetMimes = {},
}) => {
  const router = useRouter()
  const [entityId] = useState(() => category?.id ?? v7())
  const [name, setName] = useState(category?.name || '')
  const [slug, setSlug] = useState(category?.slug || '')
  const [blocks, setBlocks] = useState<BlockData[]>(initialBlocks)
  const [attributes, setAttributes] = useState<AttributeData[]>(initialAttributes)
  const [translations, setTranslations] = useState<Translations>(initialTranslations ?? {})
  const withProgress = useWithProgress()
  const showToast = useToast()
  const confirm = useConfirm()

  const handleSave = useEvent(async () => {
    await withProgress(async () => {
      try {
        const resolvedBlocks = await resolveBlocks(blocks)
        const payload = { name, slug, blocks: resolvedBlocks, translations, attributes }
        if (category) {
          handleServerResult(await editCategory(category.id, payload))
          setBlocks(resolvedBlocks)
          router.refresh()
          showToast('info', 'Saved!', { timeout: 1000 })
        } else {
          handleServerResult(await addCategory(entityId, payload))
          showToast('info', 'Saved!', { timeout: 1000 })
          router.replace(routing.entityEdit('category', entityId))
        }
      } catch (e) {
        showToast('error', extractErrorMessage(e), { timeout: 3000 })
      }
    })
  })

  const handleDelete = useEvent(async () => {
    if (!category) return
    if (
      !(await confirm({
        title: 'Delete this category?',
        message: 'All posts inside will also be deleted. This cannot be undone.',
        action: 'Delete',
        danger: true,
      }))
    )
      return
    await withProgress(async () => {
      handleServerResult(await deleteCategory(category.id))
      router.replace(routing.entityList('category'))
    })
  })

  return (
    <form
      action={handleSave}
      className="p-4 flex flex-col gap-4 items-start"
      onDragOver={preventFileNavigation}
      onDrop={preventFileNavigation}
    >
      <LocalizableField
        label="Name"
        value={name}
        onChange={setName}
        translationKey={'category:' + entityId + ':name'}
        translations={translations}
        onTranslationsChange={setTranslations}
        className="input-cnt"
        render={(value, onChange, label, placeholder) => (
          <label className="label">
            <span>{label}</span>
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="input-xl"
            />
          </label>
        )}
      />
      <div className="input-cnt">
        <label className="label">
          <span>Slug</span>
          <input
            value={slug}
            onChange={(e) => {
              e.target.value = slugify(e.target.value)
              setSlug(e.target.value)
            }}
            className="input"
          />
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
        {category && (
          <button type="button" className="button-danger" onClick={handleDelete}>
            Delete…
          </button>
        )}
        <button className="button">Save</button>
      </div>
    </form>
  )
}

const slugify = (str: string) =>
  str
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '')
