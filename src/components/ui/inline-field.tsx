'use client'

import { Check, Pencil, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ActionForm } from './action-form'
import { Button } from './button'
import { cn } from './cn'
import { Input, Textarea } from './field'
import type { Option } from './options'
import { Combobox } from './combobox'
import { Select } from './select'
import { SubmitButton } from './submit-button'

type Props = {
  /** Server Action que recibe `fields` y el nuevo valor en `name`. */
  action: (form: FormData) => unknown
  fields?: Record<string, string>
  name?: string
  label: string
  value: string
  /** Cómo se ve sin editar (por defecto, el valor). */
  display?: ReactNode
  /** `combobox`: elegir de `options` o escribir uno nuevo. */
  kind?: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'combobox'
  options?: Option[]
  placeholder?: string
  hint?: ReactNode
  success?: string
  /** Con `combobox`, si se puede escribir un valor que no está en la lista (por defecto, sí). */
  allowCustom?: boolean
  /** Oculta la etiqueta (p. ej. dentro de una tabla); sigue sirviendo de nombre accesible. */
  hideLabel?: boolean
  className?: string
}

/** Dato que se edita en su sitio: se ve como texto y con el lápiz pasa a campo con Guardar y Cancelar (Esc). */
export function InlineField({ action, fields = {}, name = 'value', label, value, display, kind = 'text', options = [], placeholder, hint, success = 'Guardado', hideLabel, allowCustom = true, className }: Props) {
  const [editing, setEditing] = useState(false)
  const shown = display ?? (kind === 'select' || kind === 'combobox' ? options.find((o) => o.value === value)?.label : value)
  return (
    <div className={cn('min-w-0', className)}>
      {!hideLabel && <div className="text-sm font-medium text-muted">{label}</div>}
      {!editing ? (
        <div className={cn('group flex min-h-11 items-center gap-2', !hideLabel && 'mt-1')}>
          <div className={cn('min-w-0 break-words text-base', !value && !display && 'text-muted')}>{display ?? (value ? shown : placeholder ?? '—')}</div>
          <Button variant="ghost" size="icon" aria-label={`Editar ${label.toLowerCase()}`} onClick={() => setEditing(true)} className="size-9 shrink-0 opacity-60 group-hover:opacity-100 focus-visible:opacity-100">
            <Pencil className="size-4" aria-hidden />
          </Button>
        </div>
      ) : (
        <ActionForm action={action} success={success} onSuccess={() => setEditing(false)} className={cn('flex flex-wrap items-start gap-2', !hideLabel && 'mt-1')}
          onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }}>
          {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <div className="min-w-56 flex-1">
            {kind === 'textarea' ? <Textarea name={name} defaultValue={value} aria-label={label} rows={3} autoFocus placeholder={placeholder} />
              : kind === 'select' ? <Select name={name} defaultValue={value} aria-label={label} options={options} />
                : kind === 'combobox' ? <Combobox name={name} defaultValue={value} aria-label={label} options={options} allowCustom={allowCustom} placeholder={placeholder} />
                : <Input name={name} type={kind} defaultValue={value} aria-label={label} autoFocus placeholder={placeholder} />}
          </div>
          <SubmitButton size="sm" aria-label="Guardar"><Check className="size-4" aria-hidden />Guardar</SubmitButton>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}><X className="size-4" aria-hidden />Cancelar</Button>
        </ActionForm>
      )}
      {hint && <div className="mt-1 text-sm text-muted">{hint}</div>}
    </div>
  )
}
