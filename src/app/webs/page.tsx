import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { runUptime } from '@/lib/uptime'
import { RefreshCw } from 'lucide-react'
import { ActionForm, Card, Combobox, Empty, Input, PageTitle, Pill, Select, SubmitButton, Table, toOptions } from '@/components/ui'
import { KUMA_STATUS_LABEL, WEB_KIND_LABEL, fmtDateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

async function addSite(form: FormData) {
  'use server'
  await requireSession()
  const raw = String(form.get('url') ?? '').trim()
  if (!raw) return
  const url = /^https?:\/\//.test(raw) ? raw : `https://${raw}`
  const kind = (String(form.get('kind')) as 'CLIENT' | 'OWN' | 'CENTRAL') || 'CLIENT'
  const c = String(form.get('client') ?? '').trim()
  const client = c ? await prisma.client.upsert({ where: { name: c }, update: {}, create: { name: c } }) : null
  await prisma.website.upsert({ where: { url }, update: { kind, clientId: client?.id }, create: { url, kind, clientId: client?.id ?? null } })
  revalidatePath('/webs')
  void import('@/lib/kuma').then((k) => k.syncKuma()).catch(() => {})
}

async function checkNow() {
  'use server'
  await requireSession()
  await runUptime()
  revalidatePath('/webs')
}

export default async function WebsPage() {
  await requireSession()
  const since = new Date(Date.now() - 7 * 864e5)
  const [sites, clients] = await Promise.all([
    prisma.website.findMany({ include: { client: true, project: true }, orderBy: [{ kind: 'asc' }, { url: 'asc' }] }),
    prisma.client.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
  ])
  const stats = await prisma.uptimeCheck.groupBy({ by: ['websiteId', 'up'], where: { checkedAt: { gte: since } }, _count: true, _avg: { ms: true } })
  const stat = (id: string) => {
    const up = stats.find((s) => s.websiteId === id && s.up)
    const down = stats.find((s) => s.websiteId === id && !s.up)
    const total = (up?._count ?? 0) + (down?._count ?? 0)
    return { pct: total ? Math.round(((up?._count ?? 0) / total) * 1000) / 10 : null, ms: up?._avg.ms ? Math.round(up._avg.ms) : null }
  }
  const groups = (['CLIENT', 'OWN', 'CENTRAL'] as const).map((k) => ({ k, list: sites.filter((s) => s.kind === k) }))
  return (
    <>
      <PageTitle
        title="Webs"
        sub={`${sites.length} webs · ${sites.filter((s) => s.lastStatus === 'down').length} caídas en la última comprobación`}
        action={<ActionForm action={checkNow} success="Comprobación terminada"><SubmitButton variant="secondary" pendingText="Comprobando…"><RefreshCw className="size-5" aria-hidden />Comprobar ahora</SubmitButton></ActionForm>}
      />
      <Card title="Añadir web" className="mb-6">
        <ActionForm action={addSite} success="Web guardada" className="grid gap-3 md:grid-cols-[minmax(16rem,2fr)_minmax(12rem,1fr)_minmax(14rem,1fr)_auto]">
          <Input name="url" placeholder="dominio.com" aria-label="Dominio o URL" required />
          <Select name="kind" aria-label="Tipo" defaultValue="CLIENT" options={toOptions(WEB_KIND_LABEL)} />
          <Combobox name="client" aria-label="Cliente" placeholder="Cliente (opcional)" allowCustom options={clients.map((c) => c.name)} />
          <SubmitButton>Añadir</SubmitButton>
        </ActionForm>
      </Card>
      <div className="flex flex-col gap-6">
        {groups.map(({ k, list }) => (
          <Card key={k} title={`Webs ${k === 'CLIENT' ? 'de clientes' : k === 'OWN' ? 'propias' : 'centralizadas'}`} note={`${list.length} webs · disponibilidad y respuesta media de los últimos 7 días`}>
            {list.length === 0 ? <Empty title="Ninguna todavía">Añádelas arriba o con <code className="font-mono">bun run websites:import</code>.</Empty> : (
              <Table head={['Web', 'Cliente / proyecto', 'Estado', 'Uptime Kuma', 'SSL', 'Uptime 7 d', 'ms medio', 'Código', 'Última']}>
                {list.map((s) => {
                  const st = stat(s.id)
                  return (
                    <tr key={s.id}>
                      <td><a href={s.url} target="_blank" rel="noreferrer" className="font-semibold text-accent-strong hover:underline">{s.label ?? s.url.replace(/^https?:\/\//, '')}</a></td>
                      <td className="text-muted">{s.client?.name ?? s.project?.name ?? '—'}</td>
                      <td>{!s.monitored ? <Pill>Sin vigilar</Pill> : s.lastStatus ? <Pill tone={s.lastStatus === 'up' ? 'ok' : 'bad'}>{s.lastStatus === 'up' ? 'En línea' : 'Caída'}</Pill> : <Pill>Sin datos</Pill>}</td>
                      <td>{!s.monitored ? <span className="text-muted">—</span> : s.kumaStatus ? <Pill tone={s.kumaStatus === 'up' ? 'ok' : s.kumaStatus === 'down' ? 'bad' : 'warn'}>{KUMA_STATUS_LABEL[s.kumaStatus] ?? s.kumaStatus}{s.kumaMs != null ? ` · ${s.kumaMs} ms` : ''}</Pill> : <span className="text-muted">{s.kumaMonitorId ? 'Sin datos' : '—'}</span>}</td>
                      <td className={`num ${s.sslDaysLeft != null && s.sslDaysLeft < 15 ? 'font-semibold text-bad' : ''}`}>{s.sslDaysLeft != null ? `${s.sslDaysLeft} d` : '—'}</td>
                      <td className="num">{st.pct == null ? '—' : `${st.pct} %`}</td>
                      <td className="num">{st.ms ?? '—'}</td>
                      <td className="num text-muted">{s.lastCode ?? '—'}</td>
                      <td className="whitespace-nowrap text-muted">{fmtDateTime(s.lastCheckedAt)}</td>
                    </tr>
                  )
                })}
              </Table>
            )}
          </Card>
        ))}
      </div>
    </>
  )
}
