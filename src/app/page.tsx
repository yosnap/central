import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { Activity, ArrowRight, FolderGit2, Globe, Wrench } from 'lucide-react'
import { Card, Empty, Notice, PageTitle, Pill, Stat, Table, buttonClass, statusTone } from '@/components/ui'
import { KIND_LABEL, STATUS_LABEL, ago } from '@/lib/format'
import { pendingCount } from '@/lib/pending'
import { serverAlerts } from '@/lib/servers/alerts'

export const dynamic = 'force-dynamic'

export default async function Home() {
  await requireSession()
  const [active, maint, webs, down, recent, uncommitted] = await Promise.all([
    prisma.project.count({ where: { excluded: false, status: 'ACTIVE', kind: { in: ['CLIENT', 'OWN'] } } }),
    prisma.project.count({ where: { excluded: false, status: 'MAINTENANCE', kind: { in: ['CLIENT', 'OWN'] } } }),
    prisma.website.count({ where: { monitored: true } }),
    prisma.website.findMany({ where: { monitored: true, lastStatus: 'down' }, include: { client: true } }),
    prisma.project.findMany({ where: { excluded: false, kind: { in: ['CLIENT', 'OWN'] } }, orderBy: { lastActivityAt: 'desc' }, take: 10, include: { client: true } }),
    prisma.project.findMany({ where: { excluded: false, status: 'ACTIVE', OR: [{ uncommitted: { gt: 0 } }, { aheadTotal: { gt: 0 } }] }, orderBy: [{ aheadTotal: { sort: 'desc', nulls: 'last' } }, { uncommitted: 'desc' }], take: 10 }),
  ])
  const [pending, servers] = await Promise.all([pendingCount(), serverAlerts()])
  const take = down.length ? `${down.length === 1 ? 'Hay 1 web caída' : `Hay ${down.length} webs caídas`}. ` : webs ? 'Todas tus webs están en línea. ' : ''
  return (
    <>
      <PageTitle title="Resumen" sub={`${take}${active} proyectos con actividad este mes.`} />
      <div className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Proyectos activos · 30 días" value={active} icon={<FolderGit2 className="size-5" aria-hidden />} />
        <Stat label="En mantenimiento · 6 meses" value={maint} icon={<Wrench className="size-5" aria-hidden />} />
        <Stat label="Webs monitorizadas" value={webs} icon={<Globe className="size-5" aria-hidden />} />
        <Stat label="Webs caídas ahora" value={down.length} tone={down.length ? 'bad' : 'ok'} icon={<Activity className="size-5" aria-hidden />} />
      </div>
      {pending.total > 0 && (
        <Notice
          tone="warn"
          className="mb-8"
          title={[pending.total - pending.gone > 0 && `${pending.total - pending.gone} proyectos con información por completar`, pending.gone > 0 && `${pending.gone} sin carpeta en disco`].filter(Boolean).join(' · ')}
          action={<Link href="/pendientes" className={buttonClass('secondary')}>Completar<ArrowRight className="size-5" aria-hidden /></Link>}
        >
          Son proyectos activos o en mantenimiento{pending.fresh ? `; ${pending.fresh} de ellos son nuevos sin revisar` : ''}.
        </Notice>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Actividad reciente" note="Proyectos de clientes y propios, por último cambio.">
          {recent.length === 0 ? <Empty title="Sin proyectos todavía">Escanea tus carpetas con <code className="font-mono">bun run scan</code>.</Empty> : (
          <Table head={['Proyecto', 'Cliente', 'Versión', 'Último cambio']}>
            {recent.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/proyectos/${p.id}`} className="font-semibold text-accent-strong hover:underline">{p.name}</Link></td>
                <td className="text-muted">{p.client?.name ?? KIND_LABEL[p.kind]}</td>
                <td className="num">{p.version ?? '—'}</td>
                <td className="text-muted">{ago(p.lastActivityAt)}</td>
              </tr>
            ))}
          </Table>
          )}
        </Card>
        <Card title="Sin guardar fuera del disco" note="Proyectos activos con ficheros sin commit o commits sin subir al remoto.">
          {uncommitted.length === 0 ? <Empty title="Todo guardado en git" /> : (
          <Table head={['Proyecto', 'Sin commit', 'Sin subir', 'Estado']}>
            {uncommitted.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/proyectos/${p.id}`} className="font-semibold text-accent-strong hover:underline">{p.name}</Link></td>
                <td className="num">{p.uncommitted || '—'}</td>
                <td className={`num ${p.aheadTotal ? 'font-semibold text-warn' : ''}`}>{p.aheadTotal || '—'}</td>
                <td><Pill tone={statusTone(p.status)}>{STATUS_LABEL[p.status]}</Pill></td>
              </tr>
            ))}
          </Table>
          )}
        </Card>
        {servers.down.length > 0 && (
          <Card title="Servidores con problemas" className="xl:col-span-2">
            <ul className="flex flex-col gap-3 text-base">
              {servers.down.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3">
                  <Pill tone={s.level === 'red' ? 'bad' : 'muted'}>{s.level === 'red' ? 'Actuar' : 'Sin dato'}</Pill>
                  <Link href={`/servidores/${s.id}`} className="font-semibold text-accent-strong hover:underline">{s.name}</Link>
                  {s.error && <span className="text-muted">{s.error}</span>}
                  {s.projects.length > 0 && <span className="text-muted">· afecta a {s.projects.map((p) => p.name).join(', ')}</span>}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {down.length > 0 && (
          <Card title="Webs caídas" className="xl:col-span-2">
            <ul className="flex flex-col gap-3 text-base">{down.map((w) => <li key={w.id} className="flex flex-wrap items-center gap-3"><Pill tone="bad">Caída</Pill><span className="font-semibold">{w.label ?? w.url}</span><span className="text-muted">{w.client?.name}</span></li>)}</ul>
          </Card>
        )}
      </div>
    </>
  )
}
