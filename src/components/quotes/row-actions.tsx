import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { moveRow } from '@/lib/quote-actions'
import { ActionForm, SubmitButton } from '@/components/ui'

/** Subir, bajar y quitar una partida o una fase. */
export function RowActions({ id, kind, first, last, remove, label }: { id: string; kind: 'item' | 'phase'; first: boolean; last: boolean; remove: (form: FormData) => unknown; label: string }) {
  const move = (dir: 'up' | 'down', disabled: boolean) => (
    <ActionForm action={moveRow}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="kind" value={kind} /><input type="hidden" name="dir" value={dir} />
      <SubmitButton variant="ghost" size="icon" disabled={disabled} aria-label={dir === 'up' ? `Subir ${label}` : `Bajar ${label}`}>
        {dir === 'up' ? <ArrowUp className="size-4" aria-hidden /> : <ArrowDown className="size-4" aria-hidden />}
      </SubmitButton>
    </ActionForm>
  )
  return (
    <div className="flex items-center justify-end">
      {move('up', first)}
      {move('down', last)}
      <ActionForm action={remove} success="Quitado del presupuesto">
        <input type="hidden" name="id" value={id} />
        <SubmitButton variant="danger-ghost" size="icon" aria-label={`Quitar ${label}`}><X className="size-4" aria-hidden /></SubmitButton>
      </ActionForm>
    </div>
  )
}
