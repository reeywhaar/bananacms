'use client'

import { type FC, type SyntheticEvent, useId, useState } from 'react'
import { Dialog } from '#cms/components/Dialog/Dialog.tsx'
import { Field } from '#cms/components/Field/Field.tsx'
import { useWithProgress } from '#cms/components/ProgressOverlay/ProgressOverlay.tsx'
import { useToast } from '#cms/components/Toast/Toast.tsx'
import { useEvent } from '#cms/hooks/useEvent.ts'
import { handleServerResult } from '#cms/lib/serverActions.ts'
import { extractErrorMessage } from '#cms/utils/extractErrorMessage.ts'
import { changePassword } from '../actions.ts'

type Errors = { current?: string; next?: string; confirm?: string }

// Changing the password: the current one, and the new one twice. What's wrong
// shows on its field once Change is pressed, as does the server's refusal of the
// current one, and goes when the field is changed. It closes when the password
// has changed.
export const ChangePasswordDialog: FC<{ onClose: () => void }> = ({ onClose }) => {
  const withProgress = useWithProgress()
  const showToast = useToast()
  const formId = useId()
  const [errors, setErrors] = useState<Errors>({})
  const clear = (field: keyof Errors) => setErrors((prev) => ({ ...prev, [field]: undefined }))

  const handleSubmit = useEvent(async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value
    const current = value('current')
    const next = value('next')
    const confirm = value('confirm')
    const found: Errors = {
      current: current ? undefined : 'Required',
      next: next.length >= 8 ? undefined : 'At least 8 characters',
      confirm: confirm === next ? undefined : "Doesn't match the new password",
    }
    setErrors(found)
    if (found.current || found.next || found.confirm) return
    await withProgress(async () => {
      try {
        const [currentHash, newHash] = await Promise.all([sha256hex(current), sha256hex(next)])
        handleServerResult(await changePassword(currentHash, newHash))
        showToast('info', 'Password updated.', { timeout: 2000 })
        onClose()
      } catch (err) {
        setErrors({ current: extractErrorMessage(err) })
      }
    })
  })

  return (
    <Dialog
      open
      onClose={onClose}
      title="Change password"
      footer={
        <>
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          {/* the form's, from outside it, so Enter in a field presses it too */}
          <button type="submit" form={formId} className="button">
            Change
          </button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Current password" error={errors.current}>
          <input
            type="password"
            name="current"
            autoComplete="current-password"
            className="input"
            data-autofocus
            onChange={() => clear('current')}
          />
        </Field>
        <Field label="New password" error={errors.next}>
          <input
            type="password"
            name="next"
            autoComplete="new-password"
            className="input"
            onChange={() => clear('next')}
          />
        </Field>
        <Field label="Confirm new password" error={errors.confirm}>
          <input
            type="password"
            name="confirm"
            autoComplete="new-password"
            className="input"
            onChange={() => clear('confirm')}
          />
        </Field>
      </form>
    </Dialog>
  )
}

async function sha256hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
