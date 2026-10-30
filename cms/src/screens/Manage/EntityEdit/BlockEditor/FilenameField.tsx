'use client'

import type { FC } from 'react'
import { Field } from '#cms/components/Field/Field.tsx'
import { filenameError } from '#cms/lib/filename.ts'

// A file's name, to change it: its asset's, or a new file's own, until it's
// changed. The change waits with the block, and the asset takes it when the entity
// is saved: every block that shows the asset has it then. It sits on what picks
// another file, so a click in it is its own.
export const FilenameField: FC<{
  // the name as it is
  name: string
  pending: string | undefined
  onChange: (pending: string | undefined) => void
}> = ({ name, pending, onChange }) => (
  <div className="w-full" onClick={(e) => e.stopPropagation()}>
    <Field error={pending === undefined ? null : filenameError(pending)}>
      <input
        aria-label="Filename"
        value={pending ?? name}
        onChange={(e) => onChange(e.target.value === name ? undefined : e.target.value)}
        className="input-sm font-mono"
      />
    </Field>
  </div>
)
