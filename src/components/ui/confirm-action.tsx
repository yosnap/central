'use client'

import { Loader2 } from 'lucide-react'
import { useState, useTransition, type ReactNode } from 'react'
import { runAction } from './action-feedback'
import { Button, type ButtonSize, type ButtonVariant } from './button'
import { Modal } from './modal'

type Props = {
  action: (form: FormData) => unknown
  /** Campos que recibe la acción, p. ej. `{ id }`. */
  fields?: Record<string, string>
  title: string
  description?: ReactNode
  confirmLabel?: string
  success?: string
  /** Texto del botón que abre la confirmación. */
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  danger?: boolean
}

/** Botón que pide confirmación en un modal antes de lanzar la acción. Sustituye a `confirm()`. */
export function ConfirmAction({ action, fields = {}, title, description, confirmLabel = 'Confirmar', success, children, variant = 'danger-ghost', size = 'sm', danger = true }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const confirm = () =>
    start(async () => {
      const form = new FormData()
      for (const [k, v] of Object.entries(fields)) form.append(k, v)
      if (await runAction(action, form, { success })) setOpen(false)
    })
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !pending && setOpen(o)}
      size="sm"
      title={title}
      description={description}
      trigger={<Button variant={variant} size={size}>{children}</Button>}
      footer={
        <>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={confirm} disabled={pending} aria-busy={pending}>
            {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}
