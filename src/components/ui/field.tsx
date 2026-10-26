import type { ComponentProps, ReactNode } from 'react'
import { cn } from './cn'

export const inputClass = cn(
  'h-12 w-full min-w-0 rounded-xl border border-line bg-panel px-4 text-base text-ink shadow-xs transition',
  'placeholder:text-muted/70 hover:border-accent/50 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15',
  'disabled:cursor-not-allowed disabled:opacity-60',
)

export function Field({ label, htmlFor, hint, children, className }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <label htmlFor={htmlFor} className="text-base font-medium">{label}</label>
      {children}
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  )
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(inputClass, className)} {...props} />
}

export function Textarea({ className, rows = 4, ...props }: ComponentProps<'textarea'>) {
  return <textarea rows={rows} className={cn(inputClass, 'h-auto py-3 leading-relaxed', className)} {...props} />
}
