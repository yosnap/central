'use client'

import * as D from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'

const SIZES = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' } as const

type Props = {
  title: ReactNode
  description?: ReactNode
  trigger?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: keyof typeof SIZES
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/** Ventana modal accesible: atrapa el foco, se cierra con Escape y bloquea el fondo. */
export function Modal({ title, description, trigger, children, footer, size = 'md', open, onOpenChange }: Props) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-[#050b16]/55 backdrop-blur-sm" />
        <D.Content className={cn('fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-3xl border border-line bg-panel text-ink shadow-2xl focus:outline-none', SIZES[size])}>
          <div className="flex items-start justify-between gap-4 px-7 pb-2 pt-7">
            <div>
              <D.Title className="text-2xl font-semibold tracking-tight">{title}</D.Title>
              {description ? <D.Description className="mt-2 text-base text-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
            </div>
            <D.Close className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl text-muted hover:bg-accent-soft hover:text-ink" aria-label="Cerrar">
              <X className="size-6" aria-hidden />
            </D.Close>
          </div>
          {children && <div className="overflow-y-auto px-7 py-4 text-base">{children}</div>}
          {footer && <div className="flex flex-wrap justify-end gap-3 border-t border-line px-7 py-5">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

export const ModalClose = D.Close
