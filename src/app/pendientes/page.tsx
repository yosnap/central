import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { CHECK_SELECT, NEEDS_INFO_WHERE, projectIssues } from '@/lib/completeness'
import { ArrowRight, Sparkles } from 'lucide-react'
import { acceptAllSuggestions } from '@/lib/project-actions'
import { ActionForm, ButtonLink, Card, Empty, PageTitle, Pill, SubmitButton, Table, cn, statusTone } from '@/components/ui'
import { KIND_LABEL, STATUS_LABEL, ago } from '@/lib/format'
import { serverAlerts } from '@/lib/servers/alerts'
import { linkOptions } from '@/lib/servers/link'
import { ContainersTable } from '@/components/servers/containers-table'
import { GoneProjectsCard } from '@/components/project/gone-projects-card'

export const dynamic = 'force-dynamic'

type SP = { ver?: 'nuevos' | 'todos' | 'activos' }

export default async function PendingPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireSession()
  const { ver = 'activos' } = await searchParams
  const projects = await prisma.project.findMany({
    where: { ...NEEDS_INFO_WHERE, ...(ver === 'activos' ? { status: { in: ['ACTIVE', 'MAINTENANCE'] } } : {}), ...(ver === 'nuevos' ? { reviewedAt: null } : {}) },
    select: CHECK_SELECT,
    orderBy: [{ reviewedAt: { sort: 'asc', nulls: 'first' } }, { lastActivityAt: 'desc' }],
  })
  const pending = projects.map((p) => ({ p, issues: projectIssues(p) })).filter((x) => x.issues.length)
  const { unprotected } = await serverAlerts()
  // servicios Docker sin proyecto: las aplicaciones y lo que sirve algún dominio (no las bases de datos internas)
  const loose = await prisma.serverContainer.findMany({
    where: { projectServiceId: null, OR: [{ role: 'app' }, { domains: { isEmpty: false } }, { role: null }] },
    include: { server: { select: { id: true, name: true } } },
    orderBy: [{ server: { name: 'asc' } }, { name: 'asc' }],
  })
  const options = loose.length ? await linkOptions() : []
  const proposals = await prisma.project.count({ where: { excluded: false, type: null, suggestedType: { not: null } } })
  const tabs = [['activos', 'Activos y en mantenimiento'], ['nuevos', 'Nuevos sin revisar'], ['todos', 'Todos']] as const
  return (
    <>
      <PageTitle
        title="Pendientes"
        sub={`${pending.length} proyectos con información por completar`}
        action={proposals > 0 && (
          <ActionForm action={acceptAllSuggestions} success="Tipos propuestos aceptados">
            <SubmitButton variant="secondary" pendingText="Aceptando…"><Sparkles className="size-5" aria-hidden />Aceptar {proposals} tipos propuestos</SubmitButton>
          </ActionForm>
        )}
      />
      <nav aria-label="Vistas" className="mb-6 inline-flex flex-wrap gap-1 rounded-2xl border border-line bg-panel p-1.5">
        {tabs.map(([k, v]) => (
          <Link key={k} href={`/pendientes?ver=${k}`} aria-current={ver === k ? 'page' : undefined} className={cn('rounded-xl px-5 py-2.5 text-base font-medium transition-colors', ver === k ? 'bg-accent text-on-accent shadow-sm' : 'text-muted hover:bg-accent-soft hover:text-ink')}>{v}</Link>
        ))}
      </nav>
      <Card>
        {pending.length === 0 ? <Empty title="Nada pendiente en esta vista">Todos los proyectos de esta vista tienen la información completa.</Empty> : (
          <Table head={['Proyecto', 'Cliente', 'Actividad', 'Qué falta', '']}>
            {pending.map(({ p, issues }) => (
              <tr key={p.id}>
                <td className="font-semibold">
                  <Link href={`/proyectos/${p.id}#pendiente`} className="text-accent-strong hover:underline">{p.name}</Link>
                  {!p.reviewedAt && <span className="ml-2"><Pill tone="warn">Nuevo</Pill></span>}
                </td>
                <td className="text-muted">{p.client?.name ?? KIND_LABEL[p.kind]}</td>
                <td><Pill tone={statusTone(p.status)}>{STATUS_LABEL[p.status]}</Pill> <span className="text-sm text-muted">{ago(p.lastActivityAt)}</span></td>
                <td>{issues.filter((i) => i.key !== 'new').map((i) => i.label).join(' · ') || 'Revisar'}</td>
                <td className="text-right"><ButtonLink href={`/proyectos/${p.id}#pendiente`} size="sm">Completar<ArrowRight className="size-4" aria-hidden /></ButtonLink></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <GoneProjectsCard />
      {loose.length > 0 && (
        <Card title="Servicios Docker sin proyecto" className="mt-6" note="Aplicaciones de tus servidores que Central no ha podido relacionar con ningún proyecto. Pulsa el lápiz y busca el proyecto; si no tiene ese servicio, se crea con su dominio.">
          <ContainersTable containers={loose} options={options} showServer />
        </Card>
      )}
      {unprotected.length > 0 && (
        <Card title="Protección de servidores" className="mt-6" note="Comprobaciones que fallan; en la ficha de cada servidor está el comando para arreglarlas.">
          <Table head={['Servidor', 'Qué falta', '']}>
            {unprotected.map((s) => (
              <tr key={s.id}>
                <td className="font-semibold"><Link href={`/servidores/${s.id}`} className="text-accent-strong hover:underline">{s.name}</Link></td>
                <td>{s.checks.map((c) => c.detail).join(' · ')}</td>
                <td className="text-right"><ButtonLink href={`/servidores/${s.id}`} size="sm">Arreglar<ArrowRight className="size-4" aria-hidden /></ButtonLink></td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  )
}
