import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { buttonClass } from './button'
import { cn } from './cn'

/**
 * Cabecera de página. `back` pone una flecha para volver en la misma fila del título; `title` puede ser un
 * elemento (p. ej. un `InlineField` con un `<h1>` dentro) para editar el nombre en su sitio.
 */
/** `sticky`: se queda arriba al hacer scroll (en escritorio), con fondo para tapar lo que pasa por debajo. */
export function PageTitle({ title, sub, action, back, sticky = false }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; back?: { href: string; label: string }; sticky?: boolean }) {
  return (
    <header className={cn('mb-8 flex flex-wrap items-end justify-between gap-4', sticky && 'lg:sticky lg:top-0 lg:z-20 lg:-mx-12 lg:border-b lg:border-line lg:bg-ground/95 lg:px-12 lg:pb-4 lg:pt-6 lg:backdrop-blur')}>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          {back && (
            <Link href={back.href} aria-label={back.label} title={back.label} className={buttonClass('ghost', 'icon', 'shrink-0')}>
              <ArrowLeft className="size-6" aria-hidden />
            </Link>
          )}
          {typeof title === 'string' ? <h1 className={TITLE}>{title}</h1> : title}
        </div>
        {sub && <div className="mt-2 flex flex-wrap items-center gap-2 text-base text-muted">{sub}</div>}
      </div>
      {action}
    </header>
  )
}

/** Clases del título de página, para quien pinte su propio `<h1>`. */
export const TITLE = 'text-3xl font-semibold tracking-tight text-balance lg:text-4xl'

export function Card({ title, note, action, children, className }: { title?: string; note?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('min-w-0 rounded-2xl border border-line bg-panel p-6 shadow-sm lg:p-7', className)}>
      {(title || action) && (
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-xl font-semibold tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      {note && <p className="mb-5 text-base text-muted">{note}</p>}
      {!note && title && <div className="mb-4" />}
      {children}
    </section>
  )
}

export function Stat({ label, value, tone, icon }: { label: string; value: ReactNode; tone?: 'ok' | 'bad' | 'warn'; icon?: ReactNode }) {
  const color = tone === 'ok' ? 'text-ok' : tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ink'
  return (
    <div className="rounded-2xl border border-line bg-panel p-6 shadow-sm">
      <div className="flex items-center gap-2 text-base text-muted">{icon}{label}</div>
      <div className={cn('num mt-2 text-4xl font-semibold tracking-tight', color)}>{value}</div>
    </div>
  )
}

const TONES = {
  ok: 'bg-ok-soft text-ok', bad: 'bg-bad-soft text-bad', warn: 'bg-warn-soft text-warn', muted: 'bg-muted/12 text-muted', accent: 'bg-accent-soft text-accent-strong',
} as const
export type Tone = keyof typeof TONES

export function Pill({ tone = 'muted', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium', TONES[tone])}>{children}</span>
}

export const statusTone = (s: string): Tone => (s === 'ACTIVE' ? 'ok' : s === 'MAINTENANCE' ? 'accent' : s === 'DORMANT' ? 'warn' : 'muted')

export function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className={cn('w-full border-collapse text-base', className)}>
        <thead>
          <tr>{head.map((h, i) => <th key={i} className="whitespace-nowrap border-b border-line px-3 py-3 text-left text-sm font-semibold text-muted">{h}</th>)}</tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:border-line [&_td]:px-3 [&_td]:py-3.5 [&_tr:hover_td]:bg-ground/60 [&_tr:last-child_td]:border-0">{children}</tbody>
      </table>
    </div>
  )
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="text-lg font-medium">{title}</p>
      {children && <div className="max-w-prose text-base text-muted">{children}</div>}
    </div>
  )
}
