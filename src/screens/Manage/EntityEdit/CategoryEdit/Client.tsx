'use client'

import { CategoryData } from '@cms/services/CategoryStore'
import { Translations } from '@cms/services/LocalizationStore'
import { AttributeData } from '@cms/services/AttributeStore'
import { useRouter } from 'next/navigation'
import { LocalizableField } from '../../LocalizableField'
import { FC, useState } from 'react'
import { addCategory, editCategory, deleteCategory } from './utils'
import { BlockEditor } from '../BlockEditor/BlockEditor'
import { AttributesEditor } from '../AttributesEditor/AttributesEditor'
import { resolveBlocks, preventFileNavigation } from '../BlockEditor/resolveBlocks'
import { routing } from '../../routing'
import { useToast } from '@cms/components/Toast/Toast'
import { useEvent } from '@cms/hooks/useEvent'
import { useWithProgress } from '@cms/components/ProgressOverlay/ProgressOverlay'
import { extractErrorMessage } from '@cms/utils/extractErrorMessage'
import { BlockData } from '@cms/lib/blocks/declarations'
import { AssetContent } from '@cms/services/AssetStore'
import { v7 } from 'uuid'

export const Client: FC<{
  category?: CategoryData
  blocks?: BlockData[]
  initialAttributes?: AttributeData[]
  translations?: Translations
  assetContents?: Record<string, AssetContent | null>
  assetSizes?: Record<string, number>
}> = ({
  category,
  blocks: initialBlocks = [],
  initialAttributes = [],
  translations: initialTranslations,
  assetContents = {},
  assetSizes = {},
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

  const handleSave = useEvent(async () => {
    await withProgress(async () => {
      try {
        const resolvedBlocks = await resolveBlocks(blocks)
        const payload = { name, slug, blocks: resolvedBlocks, translations, attributes }
        if (category) {
          await editCategory(category.id, payload)
          setBlocks(resolvedBlocks)
          router.refresh()
          showToast('info', 'Saved!', { timeout: 1000 })
        } else {
          await addCategory(entityId, payload)
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
      !window.confirm(
        'Delete this category? All posts inside will also be deleted. This cannot be undone.',
      )
    )
      return
    await withProgress(async () => {
      await deleteCategory(category.id)
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
        {category && (
          <button type="button" className="button-danger" onClick={handleDelete}>
            Delete
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
