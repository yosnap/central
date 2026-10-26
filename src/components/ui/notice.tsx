import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'

const TONES = {
  info: { box: 'border-accent/30 bg-accent-soft', text: 'text-accent-strong', Icon: Info },
  ok: { box: 'border-ok/30 bg-ok-soft', text: 'text-ok', Icon: CheckCircle2 },
  warn: { box: 'border-warn/35 bg-warn-soft', text: 'text-warn', Icon: AlertTriangle },
  bad: { box: 'border-bad/35 bg-bad-soft', text: 'text-bad', Icon: XCircle },
} as const

/** Aviso en bloque. El nivel se distingue por fondo, icono y borde completo, nunca con una franja lateral. */
export function Notice({ tone = 'info', title, children, action, className }: { tone?: keyof typeof TONES; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const t = TONES[tone]
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={cn('flex flex-wrap items-start gap-4 rounded-2xl border px-5 py-4 text-base', t.box, className)}>
      <t.Icon className={cn('mt-0.5 size-6 shrink-0', t.text)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className={cn('font-semibold', t.text)}>{title}</p>}
        {children && <div className="mt-1 text-ink">{children}</div>}
      </div>
      {action}
    </div>
  )
}
