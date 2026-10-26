import { prisma } from '@/lib/prisma'
import { addRate, deleteRate, updateRateField } from '@/lib/brand-actions'
import { UNITS, decimal, money } from '@/lib/quotes'
import { ActionForm, Card, Combobox, ConfirmAction, Empty, Field, InlineField, Input, SubmitButton, Table } from '@/components/ui'
import { RateToggle } from './rate-toggle'

const unitOptions = UNITS.map((u) => ({ value: u, label: u }))

/** Tarifas: precios de partida que se añaden a un presupuesto con un clic (y luego se ajustan en él). */
export async function RatesCard() {
  const rates = await prisma.rate.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] })
  const edit = (id: string, field: string) => ({ action: updateRateField, fields: { id, field } })
  return (
    <Card title="Paquetes y tarifas" className="xl:col-span-2" note="Paquetes de precio cerrado que repites (mantenimiento anual, publicación en tiendas…). Al añadir uno a un presupuesto se copia; cambiarlo después no toca los presupuestos hechos. Precios sin IVA.">
      <ActionForm action={addRate} success="Tarifa añadida" className="mb-5 grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
        <Field label="Nombre" htmlFor="r-name"><Input id="r-name" name="name" placeholder="Publicación en Google Play y App Store" required /></Field>
        <Field label="Unidad"><Combobox name="unit" aria-label="Unidad" defaultValue="proyecto" allowCustom options={[...UNITS]} /></Field>
        <Field label="Precio (€)" htmlFor="r-price"><Input id="r-price" name="price" inputMode="decimal" placeholder="300" required /></Field>
        <SubmitButton className="self-end">Añadir tarifa</SubmitButton>
      </ActionForm>
      {rates.length === 0 ? <Empty title="Sin paquetes todavía">Añade los que repites: mantenimiento mensual, publicación en tiendas, web básica…</Empty> : (
        <Table head={['Tarifa', 'Unidad', 'Precio', 'En uso', '']}>
          {rates.map((r) => (
            <tr key={r.id} className={r.active ? '' : 'opacity-60'}>
              <td><InlineField {...edit(r.id, 'name')} label="Nombre" hideLabel value={r.name} /></td>
              <td><InlineField {...edit(r.id, 'unit')} label="Unidad" hideLabel kind="combobox" options={unitOptions} value={r.unit} /></td>
              <td><InlineField {...edit(r.id, 'price')} label="Precio" hideLabel value={String(decimal(r.price)).replace('.', ',')} display={<span className="num">{money(Math.round(decimal(r.price) * 100))}</span>} /></td>
              <td><RateToggle id={r.id} active={r.active} /></td>
              <td className="text-right"><ConfirmAction action={deleteRate} fields={{ id: r.id }} title={`Borrar «${r.name}»`} description="Los presupuestos que ya la usan no cambian." confirmLabel="Borrar" success="Tarifa borrada">Borrar</ConfirmAction></td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  )
}
