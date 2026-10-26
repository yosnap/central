'use client'

import * as P from '@radix-ui/react-popover'
import { Command } from 'cmdk'
import { Check, ChevronsUpDown, Plus, Search, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from './cn'
import { inputClass } from './field'
import type { Option } from './options'
import { useFormValue } from './use-form-value'

type Props = {
  name?: string
  options: (string | Option)[]
  defaultValue?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  /** Permite escribir un valor que no está en la lista (sustituye a `<datalist>`). */
  allowCustom?: boolean
  required?: boolean
  id?: string
  className?: string
  'aria-label'?: string
}

const norm = (o: string | Option): Option => (typeof o === 'string' ? { value: o, label: o } : o)

/** Desplegable con buscador. Con `allowCustom` acepta texto libre además de las sugerencias. */
export function Combobox({ name, options, defaultValue = '', placeholder = 'Elige o escribe…', searchPlaceholder = 'Buscar…', emptyText = 'Sin resultados', allowCustom, required, id, className, ...aria }: Props) {
  const opts = options.map(norm)
  const { value, setValue, ref } = useFormValue(defaultValue)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = opts.find((o) => o.value === value)
  const label = selected?.label ?? value
  const q = query.trim()
  const canCreate = allowCustom && q && !opts.some((o) => o.label.toLowerCase() === q.toLowerCase())

  const pick = (v: string) => {
    setValue(v)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className={cn('relative min-w-0', className)}>
      <input ref={ref} name={name} value={value} required={required} onChange={() => {}} tabIndex={-1} aria-hidden className="pointer-events-none absolute inset-0 opacity-0" />
      <P.Root open={open} onOpenChange={setOpen}>
        <P.Trigger id={id} aria-label={aria['aria-label']} className={cn(inputClass, 'flex cursor-pointer items-center justify-between gap-3 text-left', !label && 'text-muted/80')}>
          <span className="truncate">{label || placeholder}</span>
          <ChevronsUpDown className="size-5 shrink-0 text-muted" aria-hidden />
        </P.Trigger>
        <P.Portal>
          <P.Content align="start" sideOffset={6} className="z-50 w-[max(var(--radix-popover-trigger-width),18rem)] overflow-hidden rounded-2xl border border-line bg-panel text-ink shadow-xl">
            <Command loop>
              <div className="flex items-center gap-2 border-b border-line px-4">
                <Search className="size-5 text-muted" aria-hidden />
                <Command.Input value={query} onValueChange={setQuery} placeholder={allowCustom ? 'Busca o escribe uno nuevo…' : searchPlaceholder} className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted/70" />
              </div>
              <Command.List className="max-h-80 overflow-y-auto p-1.5">
                {!canCreate && <Command.Empty className="px-4 py-6 text-center text-base text-muted">{emptyText}</Command.Empty>}
                {canCreate && (
                  <Command.Item value={`__nuevo__${q}`} onSelect={() => pick(q)} className={itemClass}>
                    <Plus className="size-5 text-accent" aria-hidden /> Usar «{q}»
                  </Command.Item>
                )}
                {value && !required && (
                  <Command.Item value="__quitar__" keywords={['quitar', 'vaciar']} onSelect={() => pick('')} className={cn(itemClass, 'text-muted')}>
                    <X className="size-5" aria-hidden /> Dejar vacío
                  </Command.Item>
                )}
                {opts.map((o) => (
                  <Command.Item key={o.value} value={`${o.label} ${o.value}`} onSelect={() => pick(o.value)} className={itemClass}>
                    <Check className={cn('size-5 text-accent', o.value === value ? 'opacity-100' : 'opacity-0')} aria-hidden />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{o.label}</span>
                      {o.hint && <span className="truncate text-sm text-muted">{o.hint}</span>}
                    </span>
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </P.Content>
        </P.Portal>
      </P.Root>
    </div>
  )
}

const itemClass = 'flex cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2.5 text-base outline-none data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent-strong'
