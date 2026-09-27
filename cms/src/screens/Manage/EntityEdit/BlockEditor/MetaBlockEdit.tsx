'use client'

import type { FC } from 'react'
import type { BlockData, BlockTypeMeta } from '#cms/lib/blocks/declarations.ts'
import { AutosizeTextarea } from '#cms/components/AutosizeTextarea/AutosizeTextarea.tsx'

type MetaBlockEditProps = {
  block: BlockData & { content: BlockTypeMeta }
  onChange: (block: BlockData) => void
}

export const MetaBlockEdit: FC<MetaBlockEditProps> = ({ block, onChange }) => {
  const update = (patch: Partial<BlockTypeMeta>) => {
    onChange({ ...block, content: { ...block.content, ...patch } })
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="label">
        <span>Text</span>
        <AutosizeTextarea value={block.content.text} onChange={(text) => update({ text })} />
      </label>
    </div>
  )
}
