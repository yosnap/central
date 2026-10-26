import { addItem, addItemFromRate, deleteItem, updateItemField } from '@/lib/quote-actions'
import { UNITS, decimal, isVariable, itemCents, itemMaxCents, moneyRange, qty, quoteTotals, type Num } from '@/lib/quotes'
import { ActionForm, Card, Empty, Field, InlineField, Input, Pill, SubmitButton, Table, type Option } from '@/components/ui'
import { RowActions } from './row-actions'

export type Item = { id: string; description: string; details: string | null; quantity: Num; unitPrice: Num; priceMax: Num | null; unit: string | null }
const unitOptions = UNITS.map((u) => ({ value: u, label: u }))
const es = (v: Num | null) => (v == null ? '' : String(decimal(v)).replace('.', ','))
const eur = (v: Num) => Math.round(decimal(v) * 100)

/** Desglose por fases, hitos o paquetes, con precio fijo o variable (desde–hasta), y los totales. */
export function ItemsCard({ quoteId, items, vat, rates }: { quoteId: string; items: Item[]; vat: Num; rates: Option[] }) {
  const t = quoteTotals(items, vat)
  const edit = (id: string, field: string) => ({ action: updateItemField, fields: { id, field } })
  const range = (min: number, max: number) => moneyRange(min, t.variable ? max : null)
  return (
    <Card title="Desglose por fases y paquetes" className="xl:col-span-3" note="Precios sin IVA. Con «hasta» el precio es variable y el total sale en rango. La cantidad solo hace falta en paquetes recurrentes (meses de mantenimiento…).">
      {items.length === 0 ? <Empty title="Sin fases todavía">Pídeselas al asistente o añádelas abajo.</Empty> : (
        <Table head={['#', 'Fase o paquete', 'Tipo', 'Precio (desde)', 'Hasta', 'Cantidad', 'Importe', '']}>
          {items.map((i, n) => (
            <tr key={i.id}>
              <td className="num align-top text-muted">{n + 1}</td>
              <td className="min-w-72 align-top">
                <InlineField {...edit(i.id, 'description')} label="Nombre" hideLabel value={i.description} display={<span className="font-semibold">{i.description}</span>} />
                <InlineField {...edit(i.id, 'details')} label="Qué incluye" hideLabel kind="textarea" value={i.details ?? ''} placeholder="Añadir qué incluye"
                  display={i.details ? <span className="whitespace-pre-wrap text-sm text-muted">{i.details}</span> : undefined} />
              </td>
              <td className="align-top"><Pill tone={isVariable(i) ? 'warn' : 'muted'}>{isVariable(i) ? 'Variable' : 'Fijo'}</Pill></td>
              <td className="w-36 align-top"><InlineField {...edit(i.id, 'unitPrice')} label="Precio" hideLabel value={es(i.unitPrice)} display={<span className="num">{moneyRange(eur(i.unitPrice))}</span>} /></td>
              <td className="w-36 align-top"><InlineField {...edit(i.id, 'priceMax')} label="Hasta" hideLabel value={es(i.priceMax)} placeholder="—" display={i.priceMax == null ? undefined : <span className="num">{moneyRange(eur(i.priceMax))}</span>} /></td>
              <td className="w-40 align-top">
                <div className="flex items-start gap-1">
                  <InlineField {...edit(i.id, 'quantity')} label="Cantidad" hideLabel value={es(i.quantity)} display={<span className="num">{qty(i.quantity)}</span>} />
                  {decimal(i.quantity) !== 1 && <InlineField {...edit(i.id, 'unit')} label="Unidad" hideLabel kind="combobox" options={unitOptions} value={i.unit ?? ''} placeholder="unidad" />}
                </div>
              </td>
              <td className="num whitespace-nowrap text-right align-top font-semibold">{moneyRange(itemCents(i), isVariable(i) ? itemMaxCents(i) : null)}</td>
              <td className="w-36 align-top"><RowActions id={i.id} kind="item" first={n === 0} last={n === items.length - 1} remove={deleteItem} label="fase" /></td>
            </tr>
          ))}
        </Table>
      )}

      <dl className="ml-auto mt-4 grid max-w-md grid-cols-[1fr_auto] gap-x-8 gap-y-2 text-base">
        <dt className="text-muted">Base imponible</dt><dd className="num text-right">{range(t.base, t.baseMax)}</dd>
        <dt className="text-muted">IVA ({qty(vat)} %)</dt><dd className="num text-right">{range(t.tax, t.taxMax)}</dd>
        <dt className="border-t border-line pt-2 text-lg font-semibold">Total</dt><dd className="num border-t border-line pt-2 text-right text-lg font-semibold">{range(t.total, t.totalMax)}</dd>
      </dl>

      <div className="mt-6 grid gap-6 border-t border-line pt-5 lg:grid-cols-[1fr_2fr]">
        <section>
          <h3 className="mb-2 font-semibold">Añadir un paquete guardado</h3>
          {rates.length === 0 ? <p className="text-sm text-muted">No hay paquetes en uso. Créalos en Ajustes › Paquetes y tarifas.</p> : (
            <InlineField action={addItemFromRate} fields={{ quoteId }} label="Paquete" hideLabel kind="combobox" allowCustom={false} options={rates} value=""
              display={<span className="text-muted">Busca un paquete…</span>} placeholder="Busca un paquete…" success="Fase añadida" />
          )}
        </section>
        <section>
          <h3 className="mb-2 font-semibold">Añadir una fase a mano</h3>
          <ActionForm action={addItem} success="Fase añadida" className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_auto]">
            <input type="hidden" name="quoteId" value={quoteId} />
            <Field label="Fase o paquete" htmlFor="ni-desc"><Input id="ni-desc" name="description" placeholder="Pantallas y navegación" required /></Field>
            <Field label="Precio (€)" htmlFor="ni-price"><Input id="ni-price" name="unitPrice" inputMode="decimal" placeholder="1400" required /></Field>
            <Field label="Hasta (€, opcional)" htmlFor="ni-max"><Input id="ni-max" name="priceMax" inputMode="decimal" placeholder="Si es variable" /></Field>
            <SubmitButton variant="secondary" className="self-end">Añadir</SubmitButton>
          </ActionForm>
        </section>
      </div>
    </Card>
  )
}
