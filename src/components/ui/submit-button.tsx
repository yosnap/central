'use client'

import { Loader2 } from 'lucide-react'
import type { ComponentProps } from 'react'
import { useFormStatus } from 'react-dom'
import { Button, type ButtonSize, type ButtonVariant } from './button'

/** Botón de envío que se bloquea y muestra un indicador mientras la Server Action trabaja. */
export function SubmitButton({ children, pendingText, variant, size, ...props }: ComponentProps<'button'> & { pendingText?: string; variant?: ButtonVariant; size?: ButtonSize }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {pending && pendingText ? pendingText : children}
    </Button>
  )
}
