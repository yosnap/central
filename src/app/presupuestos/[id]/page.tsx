import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Copy, Download, FileText, FileType, Trash2 } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { deleteQuote, duplicateQuote, updateQuoteField } from '@/lib/quote-actions'
import { decimal, money, moneyRange, qty, quoteTotals, visibleStatus } from '@/lib/quotes'
import { ActionForm, ButtonLink, Card, ConfirmAction, InlineField, Notice, PageTitle, Pill, SubmitButton, TITLE, toOptions } from '@/components/ui'
import { ItemsCard } from '@/components/quotes/items-card'
import { PhasesCard } from '@/components/quotes/phases-card'
import { AssistantCard } from '@/components/quotes/assistant-card'
import { ContentCard, type ScheduleRow } from '@/components/quotes/content-card'
import { QUOTE_STATUS_LABEL, QUOTE_STATUS_TONE, fmtDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession()
  const { id } = await params
  const q = await prisma.quote.findUnique({
    where: { id },
    include: {
      client: true, project: { select: { id: true, name: true } },
      items: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
      phases: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
    },
  })
  if (!q) notFound()
  const [clients, projects, rates, brand] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.project.findMany({ where: { excluded: false, goneAt: null }, select: { id: true, name: true, clientId: true }, orderBy: { name: 'asc' } }),
    prisma.rate.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.brandSettings.findUnique({ where: { id: 'default' }, select: { taxId: true } }),
  ])
  const shown = visibleStatus(q)
  const t = quoteTotals(q.items, q.vat)
  // primero los proyectos del cliente del presupuesto
  const projectOptions = [{ value: '', label: 'Sin proyecto' }, ...[...projects.filter((p) => p.clientId === q.clientId), ...projects.filter((p) => p.clientId !== q.clientId)]
    .map((p) => ({ value: p.id, label: p.name, hint: p.clientId === q.clientId ? 'de este cliente' : undefined }))]
  const rateOptions = rates.map((r) => ({ value: r.id, label: r.name, hint: `${money(Math.round(decimal(r.price) * 100))} / ${r.unit}` }))
  const edit = (field: string) => ({ action: updateQuoteField, fields: { id: q.id, field } })
  const missing = [!q.client.taxId && 'el NIF del cliente', !q.client.address && 'la dirección del cliente', !brand?.taxId && 'tus datos de marca (Ajustes)'].filter(Boolean)

  return (
    <>
      <PageTitle
        back={{ href: '/presupuestos', label: 'Volver a presupuestos' }}
        title={<InlineField {...edit('title')} label="Título del presupuesto" hideLabel value={q.title} display={<h1 className={TITLE}>{q.title}</h1>} success="Título cambiado" />}
        sub={<>
          <span className="font-mono">{q.number}</span>
          <Pill tone={QUOTE_STATUS_TONE[shown]}>{QUOTE_STATUS_LABEL[shown]}</Pill>
          <span>· <Link href={`/clientes/${q.client.id}`} className="font-semibold text-accent-strong hover:underline">{q.client.name}</Link></span>
          {q.project && <span>· <Link href={`/proyectos/${q.project.id}`} className="hover:underline">{q.project.name}</Link></span>}
          <span>· {moneyRange(t.total, t.variable ? t.totalMax : null)} con IVA</span>
        </>}
        action={<div className="flex flex-wrap gap-2">
          <ButtonLink href={`/presupuestos/${q.id}/pdf`} target="_blank" rel="noreferrer" variant="secondary"><FileText className="size-5" aria-hidden />Ver PDF</ButtonLink>
          <ButtonLink href={`/presupuestos/${q.id}/pdf?descargar=1`} variant="ghost"><Download className="size-5" aria-hidden />PDF</ButtonLink>
          <ButtonLink href={`/presupuestos/${q.id}/docx`} variant="ghost"><FileType className="size-5" aria-hidden />Word</ButtonLink>
          <ActionForm action={duplicateQuote} success="Presupuesto duplicado"><input type="hidden" name="id" value={q.id} /><SubmitButton variant="ghost" pendingText="Duplicando…"><Copy className="size-5" aria-hidden />Duplicar</SubmitButton></ActionForm>
          <ConfirmAction action={deleteQuote} fields={{ id: q.id }} title={`Eliminar ${q.number}`} size="md" confirmLabel="Eliminar"
            description="Se borran el presupuesto, sus partidas y sus fases. No se puede deshacer.">
            <Trash2 className="size-5" aria-hidden />Eliminar
          </ConfirmAction>
        </div>}
      />
      {missing.length > 0 && <Notice tone="info" title="Para que el PDF salga completo" className="mb-6">Falta {missing.join(', ')}.</Notice>}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Datos" className="xl:col-span-3">
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
            <InlineField {...edit('status')} label="Estado" kind="select" options={toOptions(QUOTE_STATUS_LABEL)} value={q.status}
              display={<Pill tone={QUOTE_STATUS_TONE[q.status]}>{QUOTE_STATUS_LABEL[q.status]}</Pill>}
              hint={shown !== q.status ? 'Enviado y fuera de plazo: se muestra caducado' : undefined} success="Estado cambiado" />
            <InlineField {...edit('clientId')} label="Cliente" kind="combobox" allowCustom={false} options={clients.map((c) => ({ value: c.id, label: c.name }))} value={q.clientId}
              display={<Link href={`/clientes/${q.client.id}`} className="text-accent-strong hover:underline">{q.client.name}</Link>} />
            <InlineField {...edit('projectId')} label="Proyecto" kind="combobox" allowCustom={false} options={projectOptions} value={q.projectId ?? ''} placeholder="Sin proyecto" />
            <InlineField {...edit('vat')} label="IVA (%)" value={String(decimal(q.vat)).replace('.', ',')} display={`${qty(q.vat)} %`} />
            <InlineField {...edit('issuedAt')} label="Fecha" kind="date" value={iso(q.issuedAt)} display={fmtDate(q.issuedAt)} />
            <InlineField {...edit('validUntil')} label="Válido hasta" kind="date" value={iso(q.validUntil)} placeholder="Sin límite" display={q.validUntil ? fmtDate(q.validUntil) : undefined} />
          </div>
        </Card>

        <AssistantCard quoteId={q.id} empty={q.items.length === 0} />
        <ItemsCard quoteId={q.id} items={q.items} vat={q.vat} rates={rateOptions} />
        <ContentCard q={{ ...q, schedule: (q.schedule as ScheduleRow[] | null) ?? [] }} />
        <PhasesCard quoteId={q.id} phases={q.phases} total={t.total} totalMax={t.totalMax} />
      </div>
    </>
  )
}
