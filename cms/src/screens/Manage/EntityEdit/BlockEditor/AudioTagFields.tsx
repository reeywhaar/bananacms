'use client'

import { type FC, useState } from 'react'
import { Field } from '#cms/components/Field/Field.tsx'
import { type AudioTagEdits, type AudioTags, yearError } from '#cms/lib/audioMeta.ts'

type TextTag = 'title' | 'artist' | 'album'

// An audio file's title, artist, album and year, to change, starting from what the
// file has, and from a new file's own when it replaces it. A change waits with the
// block, and saving the entity writes it into the file, which makes it a new asset.
// A field emptied clears that tag. While a new file is being read, the fields
// wait, pulsing.
export const AudioTagFields: FC<{
  // the tags as the file has them
  tags: AudioTags
  pending: AudioTagEdits | undefined
  onChange: (pending: AudioTagEdits | undefined) => void
  // a new file whose tags are still being read
  reading?: boolean
}> = ({ tags, pending, onChange, reading = false }) => {
  const inputClass = reading ? 'input animate-pulse bg-gray-100' : 'input'
  const year = pending?.year ?? tags.year
  // as typed, so that a year half typed, or not one, shows as it is
  const [yearText, setYearText] = useState(year ? String(year) : '')

  // a change, or none when a field is back to what the file has
  const set = <K extends keyof AudioTags>(key: K, value: NonNullable<AudioTags[K]>) => {
    const next: AudioTagEdits = { ...pending }
    if (value === (tags[key] ?? (key === 'year' ? 0 : ''))) delete next[key]
    else next[key] = value
    onChange(Object.keys(next).length > 0 ? next : undefined)
  }

  const textField = (key: TextTag, label: string) => (
    <Field label={label}>
      <input
        value={pending?.[key] ?? tags[key] ?? ''}
        onChange={(e) => set(key, e.target.value)}
        disabled={reading}
        className={inputClass}
      />
    </Field>
  )

  return (
    // on what picks another file, so a click in them is theirs
    <div
      aria-busy={reading}
      className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2"
      onClick={(e) => e.stopPropagation()}
    >
      {textField('title', 'Title')}
      {textField('artist', 'Artist')}
      {textField('album', 'Album')}
      <Field label="Year" error={pending?.year === undefined ? null : yearError(pending.year)}>
        <input
          inputMode="numeric"
          value={yearText}
          onChange={(e) => {
            setYearText(e.target.value)
            const text = e.target.value.trim()
            set('year', text ? Number(text) : 0)
          }}
          disabled={reading}
          className={inputClass}
        />
      </Field>
    </div>
  )
}
