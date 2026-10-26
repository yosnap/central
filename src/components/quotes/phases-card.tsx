import type { PhaseStatus } from '@/generated/prisma/client'
import { addPhase, deletePhase, updatePhaseField } from '@/lib/quote-actions'
import { decimal, money, moneyRange, phaseAmounts, qty, type Num } from '@/lib/quotes'
import { ActionForm, Card, Empty, Field, InlineField, Input, Notice, Pill, SubmitButton, Table, toOptions } from '@/components/ui'
import { PHASE_STATUS_LABEL, PHASE_STATUS_TONE, fmtDate } from '@/lib/format'
import { RowActions } from './row-actions'

export type Phase = { id: string; name: string; description: string | null; percent: Num | null; dueDate: Date | null; status: PhaseStatus; completedAt: Date | null }
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')

/** Forma de pago: qué parte del total se factura en cada hito, para cuándo y cómo va. Con total variable, el importe va en rango. */
export function PhasesCard({ quoteId, phases, total, totalMax }: { quoteId: string; phases: Phase[]; total: number; totalMax: number }) {
  const { amounts, percentSum } = phaseAmounts(phases, total)
  const { amounts: maxAmounts } = phaseAmounts(phases, totalMax)
  const invoiced = phases.reduce((s, p, i) => s + (p.status === 'INVOICED' ? amounts[i] : 0), 0)
  const edit = (id: string, field: string) => ({ action: updatePhaseField, fields: { id, field } })
  return (
    <Card title="Forma de pago y seguimiento" className="xl:col-span-3" note="Reparte el total en hitos de pago (por ejemplo 50 % al aceptar y 50 % a la entrega, o uno por fase) y marca cada uno cuando se hace y cuando se factura.">
      {phases.length > 0 && Math.abs(percentSum - 100) > 0.001 && (
        <Notice tone="warn" title={`Las fases suman ${qty(percentSum)} %`} className="mb-5">Para facturar el presupuesto entero tienen que sumar 100 %.</Notice>
      )}
      {phases.length === 0 ? <Empty title="Sin hitos de pago">Si se cobra todo de una vez no hacen falta.</Empty> : (
        <Table head={['Hito de pago', '%', 'Importe', 'Para', 'Estado', '']}>
          {phases.map((p, n) => (
            <tr key={p.id}>
              <td className="min-w-56">
                <InlineField {...edit(p.id, 'name')} label="Hito" hideLabel value={p.name} display={<span className="font-semibold">{p.name}</span>} />
                <InlineField {...edit(p.id, 'description')} label="Descripción" hideLabel kind="textarea" value={p.description ?? ''} placeholder="Añadir descripción" display={p.description ? <span className="whitespace-pre-wrap text-sm text-muted">{p.description}</span> : undefined} />
              </td>
              <td className="w-28"><InlineField {...edit(p.id, 'percent')} label="Porcentaje" hideLabel value={p.percent == null ? '' : String(decimal(p.percent)).replace('.', ',')} placeholder="—" display={p.percent == null ? undefined : <span className="num">{qty(p.percent)} %</span>} /></td>
              <td className="num whitespace-nowrap text-right">{p.percent == null ? '—' : moneyRange(amounts[n], maxAmounts[n])}</td>
              <td className="w-44"><InlineField {...edit(p.id, 'dueDate')} label="Fecha prevista" hideLabel kind="date" value={iso(p.dueDate)} placeholder="Sin fecha" display={p.dueDate ? fmtDate(p.dueDate) : undefined} /></td>
              <td className="w-48">
                <InlineField {...edit(p.id, 'status')} label="Estado" hideLabel kind="select" options={toOptions(PHASE_STATUS_LABEL)} value={p.status} display={<Pill tone={PHASE_STATUS_TONE[p.status]}>{PHASE_STATUS_LABEL[p.status]}</Pill>} />
                {p.completedAt && <div className="text-sm text-muted">desde el {fmtDate(p.completedAt)}</div>}
              </td>
              <td className="w-36"><RowActions id={p.id} kind="phase" first={n === 0} last={n === phases.length - 1} remove={deletePhase} label="hito" /></td>
            </tr>
          ))}
        </Table>
      )}
      {phases.length > 0 && <p className="mt-3 text-right text-base text-muted">Facturado: <span className="num font-semibold text-ink">{money(invoiced)}</span> de {moneyRange(total, totalMax)}</p>}
      <ActionForm action={addPhase} success="Hito añadido" className="mt-5 grid gap-2 border-t border-line pt-5 md:grid-cols-[2fr_1fr_auto]">
        <input type="hidden" name="quoteId" value={quoteId} />
        <Field label="Nuevo hito de pago" htmlFor="np-name"><Input id="np-name" name="name" placeholder="Al aceptar el presupuesto" required /></Field>
        <Field label="% del total" htmlFor="np-pct"><Input id="np-pct" name="percent" inputMode="decimal" placeholder={phases.length ? String(Math.max(0, 100 - percentSum)) : '40'} /></Field>
        <SubmitButton variant="secondary" className="self-end">Añadir hito</SubmitButton>
      </ActionForm>
    </Card>
  )
}
