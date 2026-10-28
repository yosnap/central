'use client'

import { Bell, CircleAlert, TriangleAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Menu, MenuItem, MenuLabel, MenuSeparator, cn } from './ui'

export type BellAlert = { key: string; level: 'critical' | 'warning'; kind: string; title: string; detail: string; href: string }

/** Campana de la navegación: número de alertas y las más graves; «Ver todas» lleva a /alertas. */
export function AlertsBell({ alerts, total, critical }: { alerts: BellAlert[]; total: number; critical: number }) {
  const router = useRouter()
  return (
    <Menu
      align="start"
      className="w-[min(28rem,calc(100vw-2rem))]"
      trigger={
        <button type="button" aria-label={total ? `${total} alertas abiertas` : 'Sin alertas'} className="relative grid size-11 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-ground hover:text-ink">
          <Bell className="size-6" aria-hidden />
          {total > 0 && (
            <span className={cn('num absolute -right-1 -top-1 min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold text-white', critical ? 'bg-bad' : 'bg-warn')}>{total > 99 ? '99+' : total}</span>
          )}
        </button>
      }
    >
      <MenuLabel>{total ? `${total} alertas · ${critical} críticas` : 'Sin alertas abiertas'}</MenuLabel>
      <div className="max-h-[60vh] overflow-y-auto">
        {alerts.map((a) => (
          <MenuItem key={a.key} onSelect={() => router.push(a.href)} className="items-start">
            {a.level === 'critical' ? <CircleAlert className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden /> : <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />}
            <span className="min-w-0">
              <span className="block truncate font-semibold">{a.title}</span>
              <span className="line-clamp-2 text-sm text-muted">{a.kind} · {a.detail}</span>
            </span>
          </MenuItem>
        ))}
      </div>
      <MenuSeparator />
      <MenuItem onSelect={() => router.push('/alertas')} className="justify-center font-semibold text-accent-strong">
        {total > alerts.length ? `Ver las ${total} alertas` : 'Ver todas'}
      </MenuItem>
    </Menu>
  )
}
