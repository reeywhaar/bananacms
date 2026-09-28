'use client'

import { useRouter, useSearchParams } from '#cms/framework/navigation.ts'
import { type FC, useState } from 'react'
import { useToast } from '#cms/components/Toast/Toast.tsx'
import { useEvent } from '#cms/hooks/useEvent.ts'
import type { PostData } from '#cms/services/PostStore.ts'
import { useWithProgress } from '#cms/components/ProgressOverlay/ProgressOverlay.tsx'
import type { CategoryData } from '#cms/services/CategoryStore.ts'
import type { TagData } from '#cms/services/TagStore.ts'
import type { AttributeData } from '#cms/services/AttributeStore.ts'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import { LocalizableField } from '#cms/screens/Manage/LocalizableField.tsx'
import { BlockEditor } from '../BlockEditor/BlockEditor.tsx'
import { resolveBlocks, preventFileNavigation } from '../BlockEditor/resolveBlocks.ts'
import { AttributesSection } from '../Meta/AttributesSection.tsx'
import { TagInput } from './TagInput.tsx'
import { addPost, editPost, deletePost } from './utils.ts'
import { routing } from '#cms/screens/Manage/routing.ts'
import { extractErrorMessage } from '#cms/utils/extractErrorMessage.ts'
import { v7 } from 'uuid'
import type { BlockData } from '#cms/lib/blocks/declarations.ts'
import type { AssetContent } from '#cms/services/AssetStore.ts'
import { SegmentedControl } from '#cms/components/SegmentedControl/SegmentedControl.tsx'
import { handleServerResult } from '#cms/lib/serverActions.ts'
import { useCMSLocales } from '#cms/components/CMSLocalesProvider/CMSLocalesProvider.tsx'
import { copyContent } from '../copyContent.ts'

export const Client: FC<{
  post?: PostData
  // A post a new one starts as a copy of: its fields, and the blocks, attributes and
  // translations given, which are its, under ids of the new post's own
  copyOf?: PostData
  blocks?: BlockData[]
  categories: CategoryData[]
  tags: TagData[]
  initialTagIds?: string[]
  initialAttributes?: AttributeData[]
  translations?: Translations
  assetContents?: Record<string, AssetContent>
  assetSizes?: Record<string, number>
  assetMimes?: Record<string, string>
}> = ({
  post,
  copyOf,
  blocks: initialBlocks = [],
  categories,
  tags,
  initialTagIds = [],
  initialAttributes = [],
  translations: initialTranslations,
  assetContents = {},
  assetSizes = {},
  assetMimes = {},
}) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCategoryId = searchParams.get('category')
  const [entityId] = useState(() => post?.id ?? v7())
  const { default: defaultLocale } = useCMSLocales()
  const [copy] = useState(() =>
    copyOf
      ? copyContent(
          {
            table: 'post',
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
  const source = post ?? copyOf
  const [name, setName] = useState(source?.name || '')
  const [slug, setSlug] = useState(source?.slug || '')
  const [categoryId, setCategoryId] = useState(
    source?.categoryId ??
      (preselectedCategoryId
        ? categories.find((c) => c.id === preselectedCategoryId)?.id
        : undefined) ??
      categories[0]?.id ??
      '',
  )
  const [status, setStatus] = useState<'published' | 'draft'>(source?.status ?? 'draft')
  const [blocks, setBlocks] = useState<BlockData[]>(copy?.blocks ?? initialBlocks)
  const [tagIds, setTagIds] = useState<string[]>(initialTagIds)
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
      {tags.length > 0 && <TagInput tags={tags} value={tagIds} onChange={setTagIds} />}
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
          keeping what's last on it clear; the post's status, beside what saves it */}
      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-end gap-3 border-t border-gray-200 bg-white px-4 py-3">
        <SegmentedControl
          value={status}
          onChange={setStatus}
          size="sm"
          className="mr-auto"
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'published', label: 'Published' },
          ]}
        />
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
