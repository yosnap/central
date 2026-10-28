import { cn } from './ui/cn'

/** Marca de Central: una «C» abierta alrededor del punto central. Mismo dibujo que src/app/icon.svg (favicon). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn('size-10 shrink-0', className)}>
      <rect width="64" height="64" rx="15" className="fill-accent" />
      <path d="M45.9 22.3A17 17 0 1 0 45.9 41.7" fill="none" strokeWidth="6.5" strokeLinecap="round" className="stroke-on-accent" />
      <circle cx="32" cy="32" r="6" className="fill-on-accent" />
      <circle cx="50" cy="32" r="3.5" className="fill-accent-soft" />
    </svg>
  )
}
