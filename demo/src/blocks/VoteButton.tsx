'use client'

import { useFormStatus } from 'react-dom'

// must be rendered inside the <form>: `useFormStatus` reports that form's submission
export function VoteButton(props: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      disabled={pending}
      className="w-24 rounded-lg bg-amber-400 py-1.5 text-sm font-medium hover:bg-amber-300 disabled:opacity-60"
    >
      {pending ? props.pendingLabel : props.label}
    </button>
  )
}
