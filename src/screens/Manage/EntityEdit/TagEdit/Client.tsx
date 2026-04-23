'use client'

import { TagData } from '@cms/services/TagStore'
import { Translations } from '@cms/services/LocalizationStore'
import { useRouter } from 'next/navigation'
import { LocalizableField } from '../../LocalizableField'
import { FC, useState } from 'react'
import { addTag, editTag, deleteTag } from './utils'
import { routing } from '../../routing'
import { useToast } from '@cms/components/Toast/Toast'
import { useEvent } from '@cms/hooks/useEvent'
import { useWithProgress } from '@cms/components/ProgressOverlay/ProgressOverlay'
import { extractErrorMessage } from '@cms/utils/extractErrorMessage'
import { v7 } from 'uuid'

export const Client: FC<{ tag?: TagData; translations?: Translations }> = ({
  tag,
  translations: initialTranslations,
}) => {
  const router = useRouter()
  const [entityId] = useState(() => tag?.id ?? v7())
  const [name, setName] = useState(tag?.name || '')
  const [slug, setSlug] = useState(tag?.slug || '')
  const [translations, setTranslations] = useState<Translations>(initialTranslations ?? {})
  const withProgress = useWithProgress()
  const showToast = useToast()

  const handleSave = useEvent(async () => {
    await withProgress(async () => {
      try {
        if (tag) {
          await editTag(tag.id, { name, slug, translations })
        } else {
          await addTag(entityId, { name, slug, translations })
          router.replace(routing.entityEdit('tag', entityId))
        }
        showToast('info', 'Saved!', { timeout: 1000 })
      } catch (e) {
        showToast('error', extractErrorMessage(e), { timeout: 3000 })
      }
    })
  })

  const handleDelete = useEvent(async () => {
    if (!tag) return
    if (!window.confirm('Delete this tag? This cannot be undone.')) return
    await withProgress(async () => {
      await deleteTag(tag.id)
      router.replace(routing.entityList('tag'))
    })
  })

  return (
    <form action={handleSave} className="p-4 flex flex-col gap-4 items-start">
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
      <div className="h-8" />
      <div className="flex w-full justify-end gap-3">
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
