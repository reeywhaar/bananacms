import type { FC, ReactNode } from 'react'

type FieldProps = {
  // the field's name, over it
  label?: string
  // what's wrong with it, under it, which turns its name and its border red too
  error?: string | null
  className?: string
  children: ReactNode
}

// A field: its input, with its name and what's wrong with it, if something is. The
// border of an .input in it turns red with an error (the admin's globals.css).
export const Field: FC<FieldProps> = ({ label, error, className, children }) => (
  <label
    className={['flex flex-col gap-0.5 text-gray-700', className].filter(Boolean).join(' ')}
    data-invalid={error ? '' : undefined}
  >
    {label && <span className={`text-xs ${error ? 'text-danger' : 'text-gray-500'}`}>{label}</span>}
    {children}
    {error && <span className="text-xs text-danger">{error}</span>}
  </label>
)
