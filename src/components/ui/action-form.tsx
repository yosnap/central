'use client'

import type { ComponentProps } from 'react'
import { runAction } from './action-feedback'

type Props = Omit<ComponentProps<'form'>, 'action'> & {
  action: (form: FormData) => unknown
  /** Texto del toast al terminar bien. */
  success?: string
  error?: string
  /** Se llama cuando la acción termina bien (p. ej. para cerrar un modal). */
  onSuccess?: () => void
}

/** Formulario de Server Action con aviso (toast) de éxito o error. */
export function ActionForm({ action, success, error, onSuccess, ...props }: Props) {
  return <form action={async (form) => { if (await runAction(action, form, { success, error })) onSuccess?.() }} {...props} />
}
