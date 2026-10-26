import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { money, moneyRange, phaseAmounts, quoteTotals } from '@/lib/quotes'
import { Card, Pill, Table } from '@/components/ui'
import { PHASE_STATUS_LABEL, PHASE_STATUS_TONE, fmtDate } from '@/lib/format'

/** Seguimiento: las fases de los presupuestos aceptados que aún no se han facturado, por fecha. */
export async function PhasesBoard() {
  const quotes = await prisma.quote.findMany({
    where: { status: 'ACCEPTED', phases: { some: { status: { not: 'INVOICED' } } } },
    include: { client: { select: { id: true, name: true } }, items: { select: { quantity: true, unitPrice: true } }, phases: { orderBy: [{ position: 'asc' }, { id: 'asc' }] } },
  })
  const rows = quotes.flatMap((q) => {
    const t = quoteTotals(q.items, q.vat)
    const { amounts } = phaseAmounts(q.phases, t.total)
    const { amounts: max } = phaseAmounts(q.phases, t.totalMax)
    return q.phases.map((p, n) => ({ p, q, amount: p.percent == null ? null : amounts[n], amountMax: p.percent == null ? null : max[n] })).filter((r) => r.p.status !== 'INVOICED')
  }).sort((a, b) => (a.p.dueDate?.getTime() ?? Infinity) - (b.p.dueDate?.getTime() ?? Infinity))
  if (!rows.length) return null
  const ready = rows.filter((r) => r.p.status === 'DONE').reduce((s, r) => s + (r.amount ?? 0), 0)
  const today = Date.now()
  return (
    <Card title="Fases por facturar" className="mb-6" note={`De los presupuestos aceptados. Hechas y listas para facturar: ${money(ready)}.`}>
      <Table head={['Fase', 'Presupuesto', 'Cliente', 'Para', 'Estado', 'Importe']}>
        {rows.map(({ p, q, amount, amountMax }) => (
          <tr key={p.id}>
            <td className="font-semibold">{p.name}</td>
            <td><Link href={`/presupuestos/${q.id}`} className="text-accent-strong hover:underline"><span className="font-mono text-sm">{q.number}</span> · {q.title}</Link></td>
            <td><Link href={`/clientes/${q.client.id}`} className="hover:underline">{q.client.name}</Link></td>
            <td className={p.dueDate && p.dueDate.getTime() < today && p.status !== 'DONE' ? 'whitespace-nowrap font-semibold text-warn' : 'whitespace-nowrap text-muted'}>{p.dueDate ? fmtDate(p.dueDate) : '—'}</td>
            <td><Pill tone={PHASE_STATUS_TONE[p.status]}>{PHASE_STATUS_LABEL[p.status]}</Pill></td>
            <td className="num whitespace-nowrap text-right font-semibold">{amount == null ? '—' : moneyRange(amount, amountMax)}</td>
          </tr>
        ))}
      </Table>
    </Card>
  )
}
