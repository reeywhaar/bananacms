'use client'

import { ReactNode } from 'react'

export type SegmentedControlOption<T extends string> = {
  value: T
  label: ReactNode
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T
  onChange: (value: T) => void
  options: readonly SegmentedControlOption<T>[]
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <div
      role="radiogroup"
      className={`inline-flex rounded border border-gray-300 p-0.5 gap-0.5 ${className ?? ''}`}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`px-2 py-1 flex-1 rounded ${size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'} transition-colors ${
              selected ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
