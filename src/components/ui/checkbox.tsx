'use client'

import * as C from '@radix-ui/react-checkbox'
import * as Sw from '@radix-ui/react-switch'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'

type Props = {
  name?: string
  value?: string
  defaultChecked?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  label?: ReactNode
  description?: ReactNode
  disabled?: boolean
  id?: string
  className?: string
  'aria-label'?: string
}

function Labelled({ control, label, description, className }: { control: ReactNode; label?: ReactNode; description?: ReactNode; className?: string }) {
  if (!label) return <>{control}</>
  return (
    <label className={cn('inline-flex cursor-pointer items-start gap-3 text-base', className)}>
      {control}
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        {description && <span className="text-sm text-muted">{description}</span>}
      </span>
    </label>
  )
}

/** Casilla. Con `name` envía `value` (por defecto "true") solo cuando está marcada, como la nativa. */
export function Checkbox({ value = 'true', label, description, className, onCheckedChange, ...props }: Props) {
  return (
    <Labelled
      label={label}
      description={description}
      className={className}
      control={
        <C.Root
          value={value}
          onCheckedChange={onCheckedChange && ((c) => onCheckedChange(c === true))}
          className="mt-px grid size-6 shrink-0 cursor-pointer place-items-center rounded-md border-2 border-line bg-panel text-on-accent transition hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 data-[state=checked]:border-accent data-[state=checked]:bg-accent"
          {...props}
        >
          <C.Indicator><Check className="size-4" strokeWidth={3} aria-hidden /></C.Indicator>
        </C.Root>
      }
    />
  )
}

/** Interruptor para opciones de encendido/apagado. Se envía igual que `Checkbox`. */
export function Switch({ value = 'true', label, description, className, ...props }: Props) {
  return (
    <Labelled
      label={label}
      description={description}
      className={className}
      control={
        <Sw.Root
          value={value}
          className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full bg-line transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 data-[state=checked]:bg-accent"
          {...props}
        >
          <Sw.Thumb className="block size-5 translate-x-1 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-6" />
        </Sw.Root>
      }
    />
  )
}
