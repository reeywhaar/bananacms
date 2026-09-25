'use client'

import { useRouter, useSearchParams } from '../../../../framework/navigation.ts'
import { type FC, useState } from 'react'
import { useToast } from '../../../../components/Toast/Toast.tsx'
import { useEvent } from '../../../../hooks/useEvent.ts'
import type { PostData } from '../../../../services/PostStore.ts'
import { useWithProgress } from '../../../../components/ProgressOverlay/ProgressOverlay.tsx'
import type { CategoryData } from '../../../../services/CategoryStore.ts'
import type { TagData } from '../../../../services/TagStore.ts'
import type { AttributeData } from '../../../../services/AttributeStore.ts'
import type { Translations } from '../../../../services/LocalizationStore.ts'
import { LocalizableField } from '../../LocalizableField.tsx'
import { BlockEditor } from '../BlockEditor/BlockEditor.tsx'
import { resolveBlocks, preventFileNavigation } from '../BlockEditor/resolveBlocks.ts'
import { AttributesEditor } from '../AttributesEditor/AttributesEditor.tsx'
import { TagInput } from './TagInput.tsx'
import { addPost, editPost, deletePost } from './utils.ts'
import { routing } from '../../routing.ts'
import { extractErrorMessage } from '../../../../utils/extractErrorMessage.ts'
import { v7 } from 'uuid'
import type { BlockData } from '../../../../lib/blocks/declarations.ts'
import type { AssetContent } from '../../../../services/AssetStore.ts'
import { SegmentedControl } from '../../../../components/SegmentedControl/SegmentedControl.tsx'
import { handleServerResult } from '../../../../lib/serverActions.ts'

export const Client: FC<{
  post?: PostData
  blocks?: BlockData[]
  categories: CategoryData[]
  tags: TagData[]
  initialTagIds?: string[]
  initialAttributes?: AttributeData[]
  translations?: Translations
  assetContents?: Record<string, AssetContent>
  assetSizes?: Record<string, number>
}> = ({
  post,
  blocks: initialBlocks = [],
  categories,
  tags,
  initialTagIds = [],
  initialAttributes = [],
  translations: initialTranslations,
  assetContents = {},
  assetSizes = {},
}) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCategoryId = searchParams.get('category')
  const [entityId] = useState(() => post?.id ?? v7())
  const [name, setName] = useState(post?.name || '')
  const [slug, setSlug] = useState(post?.slug || '')
  const [categoryId, setCategoryId] = useState(
    post?.categoryId ??
      (preselectedCategoryId
        ? categories.find((c) => c.id === preselectedCategoryId)?.id
        : undefined) ??
      categories[0]?.id ??
      '',
  )
  const [status, setStatus] = useState<'published' | 'draft'>(post?.status ?? 'draft')
  const [blocks, setBlocks] = useState<BlockData[]>(initialBlocks)
  const [tagIds, setTagIds] = useState<string[]>(initialTagIds)
  const [attributes, setAttributes] = useState<AttributeData[]>(initialAttributes)
  const [translations, setTranslations] = useState<Translations>(initialTranslations ?? {})
  const withProgress = useWithProgress()
  const showToast = useToast()

  const handleSave = useEvent(async () => {
    await withProgress(async () => {
      try {
        const resolvedBlocks = await resolveBlocks(blocks)
        const payload = {
          name,
          slug,
          categoryId,
          status,
          blocks: resolvedBlocks,
          translations,
          tagIds,
          attributes,
        }
        if (post) {
          handleServerResult(await editPost(post.id, payload))
          setBlocks(resolvedBlocks)
          router.refresh()
          showToast('info', 'Saved!', { timeout: 1000 })
        } else {
          handleServerResult(await addPost(entityId, payload))
          showToast('info', 'Saved!', { timeout: 1000 })
          router.replace(routing.entityEdit('post', entityId))
        }
      } catch (e) {
        showToast('error', extractErrorMessage(e), { timeout: 3000 })
      }
    })
  })

  const handleDelete = useEvent(async () => {
    if (!post) return
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    await withProgress(async () => {
      handleServerResult(await deletePost(post.id))
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
          <span>Category</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="input-xl"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <LocalizableField
        label="Name"
        value={name}
        onChange={setName}
        translationKey={'post:' + entityId + ':name'}
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
      <div className="flex flex-col md:flex-row gap-4 md:gap-2 w-full">
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
        <div className="input-cnt md:flex-[0_0_250px]">
          <label className="label">
            <span>Status</span>
            <SegmentedControl
              value={status}
              onChange={setStatus}
              size="sm"
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'published', label: 'Published' },
              ]}
            />
          </label>
        </div>
      </div>
      {tags.length > 0 && <TagInput tags={tags} value={tagIds} onChange={setTagIds} />}
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
        {post && (
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
