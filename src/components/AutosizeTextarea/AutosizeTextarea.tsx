'use client'

import { FC, useEffect, useRef } from 'react'

type AutosizeTextareaProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxRows?: number
  rows?: number
  className?: string
}

export const AutosizeTextarea: FC<AutosizeTextareaProps> = ({
  value,
  onChange,
  placeholder,
  maxRows = 20,
  rows = 3,
  className = 'input resize-none overflow-y-auto',
}) => {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      style={{ maxHeight: `${maxRows}lh` }}
      rows={rows}
    />
  )
}
