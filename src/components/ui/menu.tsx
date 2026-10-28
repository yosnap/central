'use client'

import * as M from '@radix-ui/react-dropdown-menu'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from './cn'

/** Menú desplegable de acciones. */
export function Menu({ trigger, children, align = 'end', className }: { trigger: ReactNode; children: ReactNode; align?: 'start' | 'center' | 'end'; className?: string }) {
  return (
    <M.Root>
      <M.Trigger asChild>{trigger}</M.Trigger>
      <M.Portal>
        <M.Content align={align} sideOffset={6} className={cn('z-50 min-w-56 rounded-2xl border border-line bg-panel p-1.5 text-ink shadow-xl', className)}>
          {children}
        </M.Content>
      </M.Portal>
    </M.Root>
  )
}

export function MenuItem({ className, danger, icon, children, ...props }: ComponentProps<typeof M.Item> & { danger?: boolean; icon?: ReactNode }) {
  return (
    <M.Item
      className={cn('flex cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2.5 text-base outline-none data-[highlighted]:bg-accent-soft data-[disabled]:opacity-50', danger ? 'text-bad data-[highlighted]:bg-bad/10' : 'data-[highlighted]:text-accent-strong', className)}
      {...props}
    >
      {icon}{children}
    </M.Item>
  )
}

export const MenuSeparator = () => <M.Separator className="my-1.5 h-px bg-line" />
export const MenuLabel = ({ children }: { children: ReactNode }) => <M.Label className="px-3 py-1.5 text-sm font-medium text-muted">{children}</M.Label>
