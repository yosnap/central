'use client'

import * as T from '@radix-ui/react-tabs'
import type { ReactNode } from 'react'
import { cn } from './cn'

type Tab = { value: string; label: ReactNode; content: ReactNode }

/** Pestañas accesibles (flechas del teclado para cambiar). La primera abierta es `defaultValue` o la primera. */
export function Tabs({ tabs, defaultValue, className }: { tabs: Tab[]; defaultValue?: string; className?: string }) {
  return (
    <T.Root defaultValue={defaultValue ?? tabs[0]?.value} className={className}>
      <T.List className="mb-5 inline-flex flex-wrap gap-1 rounded-2xl border border-line bg-ground p-1.5">
        {tabs.map((t) => (
          <T.Trigger key={t.value} value={t.value}
            className={cn('inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-base font-medium text-muted transition-colors hover:text-ink',
              'data-[state=active]:bg-panel data-[state=active]:text-ink data-[state=active]:shadow-sm focus-visible:outline-2 focus-visible:outline-accent')}>
            {t.label}
          </T.Trigger>
        ))}
      </T.List>
      {tabs.map((t) => <T.Content key={t.value} value={t.value} className="focus-visible:outline-none">{t.content}</T.Content>)}
    </T.Root>
  )
}
