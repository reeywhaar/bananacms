'use client'

import { FC, KeyboardEvent, useMemo, useState } from 'react'
import { TagData } from '@cms/services/TagStore'

type TagInputProps = {
  tags: TagData[]
  value: string[]
  onChange: (ids: string[]) => void
}

export const TagInput: FC<TagInputProps> = ({ tags, value, onChange }) => {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])
  const selected = value.map((id) => tagsById.get(id)).filter((t): t is TagData => !!t)

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return tags
      .filter((t) => !value.includes(t.id))
      .filter((t) => !needle || t.name.toLowerCase().includes(needle))
      .slice(0, 10)
  }, [tags, value, query])

  const add = (id: string) => {
    if (value.includes(id)) return
    onChange([...value, id])
    setQuery('')
  }

  const remove = (id: string) => onChange(value.filter((v) => v !== id))

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions[0]) add(suggestions[0].id)
    } else if (e.key === 'Backspace' && !query && selected.length > 0) {
      remove(selected[selected.length - 1].id)
    }
  }

  return (
    <div className="input-cnt">
      <label className="label">
        <span>Tags</span>
        <div className="w-full p-1 border border-gray-300 rounded flex flex-wrap gap-1 items-center">
          {selected.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-sm"
            >
              {tag.name}
              <button
                type="button"
                onClick={() => remove(tag.id)}
                className="text-gray-500 hover:text-red-500"
                aria-label={`Remove ${tag.name}`}
              >
                ×
              </button>
            </span>
          ))}
          <div className="relative flex-1 min-w-[8rem]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder={selected.length ? '' : 'Add tag…'}
              className="w-full text-sm outline-none"
            />
            {focused && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border border-gray-300 rounded shadow-sm max-h-48 overflow-auto">
                {suggestions.map((tag) => (
                  <li key={tag.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => add(tag.id)}
                      className="w-full text-left px-2 py-1 text-sm hover:bg-gray-100"
                    >
                      {tag.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </label>
    </div>
  )
}
