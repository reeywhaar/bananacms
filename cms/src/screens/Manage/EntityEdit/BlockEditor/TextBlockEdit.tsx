'use client'

import type { FC } from 'react'
import type {
  BlockData,
  BlockTypeText,
  TextBlockContentType,
} from '#cms/lib/blocks/declarations.ts'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import { LocalizableField } from '#cms/screens/Manage/LocalizableField.tsx'
import { AutosizeTextarea } from '#cms/components/AutosizeTextarea/AutosizeTextarea.tsx'
import { SegmentedControl } from '#cms/components/SegmentedControl/SegmentedControl.tsx'

type TextBlockEditProps = {
  block: BlockData & { content: BlockTypeText }
  onChange: (block: BlockData) => void
  translations: Translations
  onTranslationsChange: (translations: Translations) => void
}

export const TextBlockEdit: FC<TextBlockEditProps> = ({
  block,
  onChange,
  translations,
  onTranslationsChange,
}) => {
  const update = (patch: Partial<BlockTypeText>) => {
    onChange({ ...block, content: { ...block.content, ...patch } })
  }

  const contentTypeOptions: { value: TextBlockContentType; label: string }[] = [
    { value: 'plain', label: 'Plain' },
    { value: 'markdown', label: 'Markdown' },
    { value: 'html', label: 'HTML' },
  ]

  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl
        value={block.content.contentType ?? 'plain'}
        onChange={(contentType) => update({ contentType })}
        options={contentTypeOptions}
        size="sm"
        className="w-full"
      />
      <LocalizableField
        label="Text"
        value={block.content.text}
        onChange={(text) => update({ text })}
        translationKey={'block:' + block.id + ':text'}
        translations={translations}
        onTranslationsChange={onTranslationsChange}
        className="input-cnt"
        render={(value, onChange, label, placeholder) => (
          <label className="label">
            <span>{label}</span>
            <AutosizeTextarea value={value} onChange={onChange} placeholder={placeholder} />
          </label>
        )}
      />
    </div>
  )
}
