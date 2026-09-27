'use client'

import { type FC, useState } from 'react'
import type { BlockData } from '#cms/lib/blocks/declarations.ts'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import { Dialog } from '#cms/components/Dialog/Dialog.tsx'
import { useToast } from '#cms/components/Toast/Toast.tsx'
import { useCMSLocales } from '#cms/components/CMSLocalesProvider/CMSLocalesProvider.tsx'
import { extractErrorMessage } from '#cms/utils/extractErrorMessage.ts'
import { serializeBlocks, deserializeData } from './serialize.ts'
import JSON5 from 'json5'

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
  const [value, setValue] = useState(() =>
    JSON.stringify(serializeBlocks(blocks, translations, defaultLocale), null, 2),
  )
  const [saving, setSaving] = useState(false)
  const showToast = useToast()

  const handleSave = () => {
    setSaving(true)
    try {
      // JSON5 tolerates trailing commas, comments, and single quotes — the
      // textarea is hand-edited, strict JSON syntax errors are just friction.
      const result = deserializeData(JSON5.parse(value), translations, defaultLocale, blocks)
      onSave(result.blocks, result.translations)
      onClose()
    } catch (e) {
      showToast('error', extractErrorMessage(e), { timeout: 4000 })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Blocks JSON"
      wide
      footer={
        <>
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <textarea
        className="w-full rounded border border-gray-300 p-2 text-xs font-mono resize-y"
        rows={20}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
      />
    </Dialog>
  )
}
