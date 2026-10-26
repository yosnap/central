import Form from 'next/form'
import Link from 'next/link'
import { FileText, Search } from 'lucide-react'
import type { Prisma, QuoteStatus } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { Button, ButtonLink, Card, Empty, Input, PageTitle, Pill, Select, Stat, Table, toOptions } from '@/components/ui'
import { NewQuoteButton } from '@/components/quotes/new-quote-button'
import { PhasesBoard } from '@/components/quotes/phases-board'
import { QUOTE_STATUS_LABEL, QUOTE_STATUS_TONE, fmtDate } from '@/lib/format'
import { money, moneyRange, quoteTotals, visibleStatus } from '@/lib/quotes'

export const dynamic = 'force-dynamic'

type SP = { q?: string; estado?: string; cliente?: string }

export default async function QuotesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireSession()
  const sp = await searchParams
  const where: Prisma.QuoteWhereInput = {
    ...(sp.q ? { OR: [{ number: { contains: sp.q, mode: 'insensitive' } }, { title: { contains: sp.q, mode: 'insensitive' } }, { client: { name: { contains: sp.q, mode: 'insensitive' } } }] } : {}),
    ...(sp.cliente ? { clientId: sp.cliente } : {}),
  }
  const [rows, clients, projects] = await Promise.all([
    prisma.quote.findMany({
      where, orderBy: [{ issuedAt: 'desc' }, { number: 'desc' }],
      include: { client: { select: { id: true, name: true } }, project: { select: { id: true, name: true } }, items: { select: { quantity: true, unitPrice: true } }, _count: { select: { phases: true } } },
    }),
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.project.findMany({ where: { excluded: false, goneAt: null }, select: { id: true, name: true, client: { select: { name: true } } }, orderBy: { name: 'asc' } }),
  ])
  // el estado visible tiene en cuenta la validez: un enviado vencido cuenta como caducado
  const all = rows.map((q) => ({ ...q, shown: visibleStatus(q), totals: quoteTotals(q.items, q.vat) }))
  const quotes = sp.estado ? all.filter((q) => q.shown === sp.estado) : all
  const sum = (s: QuoteStatus) => all.filter((q) => q.shown === s).reduce((t, q) => t + q.totals.total, 0)
  const count = (s: QuoteStatus) => all.filter((q) => q.shown === s).length
  const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }))
  const projectOptions = projects.map((p) => ({ value: p.id, label: p.name, hint: p.client?.name }))
  const filtered = !!(sp.q || sp.estado || sp.cliente)

  return (
    <>
      <PageTitle title="Presupuestos" sub={`${quotes.length} presupuestos${filtered ? ' con estos filtros' : ''}`} action={<NewQuoteButton clients={clientOptions} projects={projectOptions} />} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={`Borradores · ${count('DRAFT')}`} value={money(sum('DRAFT'))} />
        <Stat label={`Enviados, pendientes de respuesta · ${count('SENT')}`} value={money(sum('SENT'))} />
        <Stat label={`Aceptados · ${count('ACCEPTED')}`} value={money(sum('ACCEPTED'))} />
        <Stat label={`Rechazados o caducados · ${count('REJECTED') + count('EXPIRED')}`} value={money(sum('REJECTED') + sum('EXPIRED'))} />
      </div>
      {!filtered && <PhasesBoard />}
      <Form action="/presupuestos" key={JSON.stringify(sp)} className="mb-6 grid gap-3 md:grid-cols-[minmax(18rem,2fr)_repeat(2,minmax(12rem,1fr))_auto]">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <Input name="q" defaultValue={sp.q} placeholder="Buscar número, título o cliente" aria-label="Buscar" className="pl-12" />
        </div>
        <Select name="estado" defaultValue={sp.estado ?? ''} aria-label="Estado" submitOnChange options={[{ value: '', label: 'Cualquier estado' }, ...toOptions(QUOTE_STATUS_LABEL)]} />
        <Select name="cliente" defaultValue={sp.cliente ?? ''} aria-label="Cliente" submitOnChange options={[{ value: '', label: 'Todos los clientes' }, ...clientOptions]} />
        <div className="flex gap-2">
          <Button type="submit">Buscar</Button>
          {filtered && <ButtonLink href="/presupuestos" variant="ghost">Limpiar</ButtonLink>}
        </div>
      </Form>
      <Card>
        {quotes.length === 0 ? (
          <Empty icon={<FileText className="size-10" aria-hidden />} title={filtered ? 'Ningún presupuesto con esos filtros' : 'Aún no hay presupuestos'}>
            {!filtered && 'Crea el primero con «Nuevo presupuesto». Antes conviene rellenar en Ajustes los datos de tu marca, el logo y las tarifas.'}
          </Empty>
        ) : (
          <Table head={['Número', 'Presupuesto', 'Cliente', 'Estado', 'Fecha', 'Válido hasta', 'Total']}>
            {quotes.map((q) => (
              <tr key={q.id}>
                <td className="font-mono text-sm"><Link href={`/presupuestos/${q.id}`} className="text-accent-strong hover:underline">{q.number}</Link></td>
                <td>
                  <Link href={`/presupuestos/${q.id}`} className="font-semibold hover:underline">{q.title}</Link>
                  {q.project && <div className="text-sm text-muted">{q.project.name}</div>}
                </td>
                <td><Link href={`/clientes/${q.client.id}`} className="hover:underline">{q.client.name}</Link></td>
                <td><Pill tone={QUOTE_STATUS_TONE[q.shown]}>{QUOTE_STATUS_LABEL[q.shown]}</Pill></td>
                <td className="whitespace-nowrap text-muted">{fmtDate(q.issuedAt)}</td>
                <td className="whitespace-nowrap text-muted">{fmtDate(q.validUntil)}</td>
                <td className="num whitespace-nowrap text-right font-semibold">{moneyRange(q.totals.total, q.totals.variable ? q.totals.totalMax : null)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  )
}
