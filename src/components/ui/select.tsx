'use client'

import * as S from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from './cn'
import { inputClass } from './field'
import type { Option } from './options'
import { useFormValue } from './use-form-value'

// Radix no admite items con valor vacío; se traduce a un centinela y el formulario recibe ''.
const EMPTY = '__vacio__'

type Props = {
  name?: string
  options: Option[]
  defaultValue?: string
  placeholder?: string
  required?: boolean
  /** Envía el formulario al elegir (filtros). */
  submitOnChange?: boolean
  onValueChange?: (value: string) => void
  id?: string
  className?: string
  'aria-label'?: string
}

export function Select({ name, options, defaultValue = '', placeholder = 'Elige una opción', required, submitOnChange, onValueChange, id, className, ...aria }: Props) {
  const { value, setValue, ref, input } = useFormValue(defaultValue)
  const hasEmpty = options.some((o) => o.value === '')
  const radixValue = value === '' ? (hasEmpty ? EMPTY : '') : value

  const change = (v: string) => {
    if (window.event?.type === 'reset') return // Radix restaura su valor inicial; lo gestiona useFormValue
    const real = v === EMPTY ? '' : v
    setValue(real)
    onValueChange?.(real)
    const el = input()
    if (submitOnChange && el?.form) {
      el.value = real // el input oculto aún no se ha re-renderizado
      el.form.requestSubmit()
    }
  }

  return (
    <div className={cn('relative min-w-0', className)}>
      {/* Lleva el valor al FormData y permite la validación `required` del formulario */}
      <input ref={ref} name={name} value={value} required={required} onChange={() => {}} tabIndex={-1} aria-hidden className="pointer-events-none absolute inset-0 opacity-0" />
      <S.Root value={radixValue} onValueChange={change}>
        <S.Trigger id={id} aria-label={aria['aria-label']} className={cn(inputClass, 'flex cursor-pointer items-center justify-between gap-3 text-left data-[placeholder]:text-muted/80')}>
          <span className="truncate"><S.Value placeholder={placeholder} /></span>
          <S.Icon><ChevronDown className="size-5 text-muted" aria-hidden /></S.Icon>
        </S.Trigger>
        <S.Portal>
          <S.Content position="popper" sideOffset={6} className="z-50 max-h-[min(26rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-line bg-panel text-ink shadow-xl">
          <S.Viewport className="p-1.5">
              {options.map((o) => (
                <S.Item key={o.value || EMPTY} value={o.value || EMPTY} className="relative flex cursor-pointer select-none flex-col rounded-xl py-2.5 pl-11 pr-4 text-base outline-none data-[highlighted]:bg-accent-soft data-[highlighted]:text-accent-strong data-[state=checked]:font-semibold">
                  <S.ItemIndicator className="absolute left-3.5 top-3"><Check className="size-5 text-accent" aria-hidden /></S.ItemIndicator>
                  <S.ItemText>{o.label}</S.ItemText>
                  {o.hint && <span className="text-sm font-normal text-muted">{o.hint}</span>}
                </S.Item>
              ))}
            </S.Viewport>
          </S.Content>
        </S.Portal>
      </S.Root>
    </div>
  )
}
