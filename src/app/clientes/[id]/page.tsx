import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Mail, Phone, Trash2 } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { addClientNote, deleteClient, updateClientField } from '@/lib/client-actions'
import { ActionForm, ButtonLink, Card, ConfirmAction, Empty, InlineField, PageTitle, Pill, SubmitButton, TITLE, Table, Textarea } from '@/components/ui'
import { ClientProjectsCard } from '@/components/clients/client-projects-card'
import { NewQuoteButton } from '@/components/quotes/new-quote-button'
import { ClientCommsCard } from '@/components/clients/client-comms-card'
import { KUMA_STATUS_LABEL, QUOTE_STATUS_LABEL, QUOTE_STATUS_TONE, ago, fmtDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession()
  const { id } = await params
  const live = { excluded: false, goneAt: null }
  const c = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: {
        where: live, orderBy: { lastActivityAt: { sort: 'desc', nulls: 'last' } },
        select: { id: true, name: true, status: true, version: true, framework: true, lastActivityAt: true, _count: { select: { websites: true } } },
      },
      websites: { orderBy: { url: 'asc' }, select: { id: true, url: true, label: true, lastStatus: true, kumaStatus: true, sslDaysLeft: true, project: { select: { id: true, name: true } } } },
      quotes: { orderBy: { issuedAt: 'desc' }, select: { id: true, number: true, title: true, status: true, issuedAt: true, validUntil: true } },
      notes: { orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }] },
      messages: { orderBy: { receivedAt: 'desc' }, take: 20, select: { id: true, fromAddress: true, subject: true, snippet: true, receivedAt: true, threadId: true, account: { select: { address: true } } } },
      events: { orderBy: { start: 'desc' }, take: 30, select: { id: true, summary: true, start: true, allDay: true, htmlLink: true } },
    },
  })
  if (!c) notFound()
  // los proyectos sin cliente primero; los de otro cliente también se pueden pasar a este
  const [others, allClients] = await Promise.all([prisma.project.findMany({
    where: { ...live, OR: [{ clientId: null }, { clientId: { not: id } }] },
    select: { id: true, name: true, kind: true, client: { select: { name: true } } },
    orderBy: { name: 'asc' },
  }), prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })])
  const candidates = [...others.filter((p) => !p.client), ...others.filter((p) => p.client)].map((p) => ({
    value: p.id, label: p.name, hint: p.client ? `ahora de ${p.client.name}` : p.kind === 'CLIENT' ? 'sin cliente' : undefined,
  }))
  const edit = (field: string) => ({ action: updateClientField, fields: { id: c.id, field } })

  return (
    <>
      <PageTitle
        back={{ href: '/clientes', label: 'Volver a clientes' }}
        title={<InlineField {...edit('name')} label="Nombre del cliente" hideLabel value={c.name} display={<h1 className={TITLE}>{c.name}</h1>} success="Nombre cambiado" />}
        sub={<span>{[c.company, `${c.projects.length} proyectos`, `cliente desde ${fmtDate(c.createdAt)}`].filter(Boolean).join(' · ')}</span>}
        action={<div className="flex flex-wrap gap-2">
          {c.email && <ButtonLink href={`mailto:${c.email}`} variant="ghost"><Mail className="size-5" aria-hidden />Escribir</ButtonLink>}
          {c.phone && <ButtonLink href={`tel:${c.phone.replace(/\s/g, '')}`} variant="ghost"><Phone className="size-5" aria-hidden />Llamar</ButtonLink>}
          <ConfirmAction action={deleteClient} fields={{ id: c.id }} title={`Eliminar ${c.name}`} size="md" confirmLabel="Eliminar"
            description="Sus proyectos y webs quedan sin cliente y se borran sus notas. Si tiene presupuestos no se puede eliminar.">
            <Trash2 className="size-5" aria-hidden />Eliminar cliente
          </ConfirmAction>
        </div>}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Datos" note="Se usan en los presupuestos. Pulsa el lápiz para cambiar cada uno.">
          <div className="flex flex-col gap-4">
            <InlineField {...edit('company')} label="Empresa (razón social)" value={c.company ?? ''} placeholder="—" />
            <InlineField {...edit('taxId')} label="NIF / CIF" value={c.taxId ?? ''} placeholder="—" />
            <InlineField {...edit('email')} label="Correo" value={c.email ?? ''} placeholder="—"
              display={c.email ? <a href={`mailto:${c.email}`} className="break-all text-accent-strong hover:underline">{c.email}</a> : undefined} />
            <InlineField {...edit('phone')} label="Teléfono" value={c.phone ?? ''} placeholder="—" />
            <InlineField {...edit('address')} label="Dirección" kind="textarea" value={c.address ?? ''} placeholder="—" display={c.address ? <span className="whitespace-pre-wrap">{c.address}</span> : undefined} />
          </div>
        </Card>

        <ClientProjectsCard clientId={c.id} clientName={c.name} projects={c.projects} candidates={candidates} />

        <Card title="Webs" className="xl:col-span-2" note="Las webs de sus proyectos y las que tengas a su nombre en Webs.">
          {c.websites.length === 0 ? <Empty title="Sin webs" /> : (
            <Table head={['Web', 'Proyecto', 'Estado', 'SSL']}>
              {c.websites.map((w) => {
                const status = w.kumaStatus ?? w.lastStatus
                return (
                  <tr key={w.id}>
                    <td><a href={w.url} target="_blank" rel="noreferrer" className="break-all font-semibold text-accent-strong hover:underline">{w.url.replace(/^https?:\/\//, '')}</a>{w.label && <div className="text-sm text-muted">{w.label}</div>}</td>
                    <td>{w.project ? <Link href={`/proyectos/${w.project.id}`} className="hover:underline">{w.project.name}</Link> : <span className="text-muted">—</span>}</td>
                    <td>{status ? <Pill tone={status === 'up' ? 'ok' : status === 'down' ? 'bad' : 'muted'}>{KUMA_STATUS_LABEL[status] ?? status}</Pill> : <span className="text-muted">—</span>}</td>
                    <td className="num">{w.sslDaysLeft != null ? `${w.sslDaysLeft} días` : '—'}</td>
                  </tr>
                )
              })}
            </Table>
          )}
        </Card>

        <Card title="Presupuestos" action={<NewQuoteButton variant="secondary" clientId={c.id} clients={allClients.map((x) => ({ value: x.id, label: x.name }))}
          projects={[...c.projects.map((p) => ({ value: p.id, label: p.name, hint: 'de este cliente' })), ...others.map((p) => ({ value: p.id, label: p.name, hint: p.client?.name }))]} />}>
          {c.quotes.length === 0 ? <Empty title="Sin presupuestos" /> : (
            <ul className="flex flex-col gap-3">
              {c.quotes.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center gap-2 border-t border-line pt-3 first:border-0 first:pt-0">
                  <Link href={`/presupuestos/${q.id}`} className="font-mono text-sm text-accent-strong hover:underline">{q.number}</Link>
                  <Link href={`/presupuestos/${q.id}`} className="font-medium hover:underline">{q.title}</Link>
                  <Pill tone={QUOTE_STATUS_TONE[q.status]}>{QUOTE_STATUS_LABEL[q.status]}</Pill>
                  <span className="text-sm text-muted">{fmtDate(q.issuedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <ClientCommsCard clientId={c.id} messages={c.messages} events={[...c.events].reverse()} />

        <Card title="Notas" className="xl:col-span-3">
          <ActionForm action={addClientNote} success="Nota añadida" className="mb-5 flex flex-col gap-3">
            <input type="hidden" name="id" value={c.id} />
            <Textarea name="body" rows={3} aria-label="Nueva nota" placeholder="Nota sobre el cliente: acuerdos, preferencias, contactos…" required />
            <SubmitButton variant="secondary" className="self-start">Añadir nota</SubmitButton>
          </ActionForm>
          <ul className="flex flex-col gap-3 text-base">
            {c.notes.map((n) => <li key={n.id} className="border-t border-line pt-3"><p className="whitespace-pre-wrap">{n.body}</p><p className="mt-1 text-sm text-muted">{ago(n.createdAt)} · {n.source}</p></li>)}
          </ul>
        </Card>
      </div>
    </>
  )
}
