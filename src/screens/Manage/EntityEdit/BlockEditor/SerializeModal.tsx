'use client'

import { FC, useEffect, useRef, useState } from 'react'
import { BlockData } from '@cms/lib/blocks/declarations'
import { Translations } from '@cms/services/LocalizationStore'
import { useToast } from '@cms/components/Toast/Toast'
import { useCMSLocales } from '@cms/components/CMSLocalesProvider/CMSLocalesProvider'
import { extractErrorMessage } from '@cms/utils/extractErrorMessage'
import { serializeBlocks, deserializeData } from './serialize'

type SerializeModalProps = {
  blocks: BlockData[]
  translations: Translations
  onSave: (blocks: BlockData[], translations: Translations) => void
  onClose: () => void
}

export const SerializeModal: FC<SerializeModalProps> = ({
  blocks,
  translations,
  onSave,
  onClose,
}) => {
  const { default: defaultLocale } = useCMSLocales()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(() =>
    JSON.stringify(serializeBlocks(blocks, translations, defaultLocale), null, 2),
  )
  const [saving, setSaving] = useState(false)
  const showToast = useToast()

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handler = () => onClose()
    dialog.addEventListener('close', handler)
    return () => dialog.removeEventListener('close', handler)
  }, [onClose])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose()
  }

  const handleSave = () => {
    setSaving(true)
    try {
      const result = deserializeData(JSON.parse(value), translations, defaultLocale)
      onSave(result.blocks, result.translations)
      onClose()
    } catch (e) {
      showToast('error', extractErrorMessage(e), { timeout: 4000 })
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={handleBackdropClick}
      className="m-auto w-full max-w-2xl rounded-lg shadow-xl p-4 backdrop:bg-black/50 flex flex-col gap-3 open:flex"
    >
      <h2 className="text-sm font-semibold text-gray-700">Blocks JSON</h2>
      <textarea
        className="w-full rounded border border-gray-300 p-2 text-xs font-mono resize-y"
        rows={20}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
      />
      <div className="flex justify-end gap-2">
        <button type="button" className="button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </dialog>
  )
}
