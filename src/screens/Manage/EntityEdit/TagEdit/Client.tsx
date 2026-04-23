'use client'

import { TagData } from '@cms/services/TagStore'
import { AttributeData } from '@cms/services/AttributeStore'
import { Translations } from '@cms/services/LocalizationStore'
import { AssetImageContent } from '@cms/services/AssetStore'
import { BlockData } from '@cms/lib/blocks/declarations'
import { useRouter } from 'next/navigation'
import { LocalizableField } from '../../LocalizableField'
import { AttributesEditor } from '../AttributesEditor/AttributesEditor'
import { BlockEditor } from '../BlockEditor/BlockEditor'
import { resolveBlocks, preventFileNavigation } from '../BlockEditor/resolveBlocks'
import { FC, useState } from 'react'
import { addTag, editTag, deleteTag } from './utils'
import { routing } from '../../routing'
import { useToast } from '@cms/components/Toast/Toast'
import { useEvent } from '@cms/hooks/useEvent'
import { useWithProgress } from '@cms/components/ProgressOverlay/ProgressOverlay'
import { extractErrorMessage } from '@cms/utils/extractErrorMessage'
import { v7 } from 'uuid'
import { handleServerResult } from '@cms/lib/serverActions'

export const Client: FC<{
  tag?: TagData
  blocks?: BlockData[]
  translations?: Translations
  initialAttributes?: AttributeData[]
  assetContents?: Record<string, AssetImageContent>
  assetSizes?: Record<string, number>
}> = ({
  tag,
  blocks: initialBlocks = [],
  translations: initialTranslations,
  initialAttributes = [],
  assetContents = {},
  assetSizes = {},
}) => {
  const router = useRouter()
  const [entityId] = useState(() => tag?.id ?? v7())
  const [name, setName] = useState(tag?.name || '')
  const [slug, setSlug] = useState(tag?.slug || '')
  const [blocks, setBlocks] = useState<BlockData[]>(initialBlocks)
  const [attributes, setAttributes] = useState<AttributeData[]>(initialAttributes)
  const [translations, setTranslations] = useState<Translations>(initialTranslations ?? {})
  const withProgress = useWithProgress()
  const showToast = useToast()

  const handleSave = useEvent(async () => {
    await withProgress(async () => {
      try {
        const resolvedBlocks = await resolveBlocks(blocks)
        const payload = { name, slug, translations, attributes, blocks: resolvedBlocks }
        if (tag) {
          handleServerResult(await editTag(tag.id, payload))
          setBlocks(resolvedBlocks)
          router.refresh()
          showToast('info', 'Saved!', { timeout: 1000 })
        } else {
          handleServerResult(await addTag(entityId, payload))
          showToast('info', 'Saved!', { timeout: 1000 })
          router.replace(routing.entityEdit('tag', entityId))
        }
      } catch (e) {
        showToast('error', extractErrorMessage(e), { timeout: 3000 })
      }
    })
  })

  const handleDelete = useEvent(async () => {
    if (!tag) return
    if (!window.confirm('Delete this tag? This cannot be undone.')) return
    await withProgress(async () => {
      handleServerResult(await deleteTag(tag.id))
      router.replace(routing.entityList('tag'))
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
        translationKey={'tag:' + entityId + ':name'}
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
        {tag && (
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
