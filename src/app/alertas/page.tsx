import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { requireSession } from '@/lib/session'
import { ALERT_KIND_LABEL, collectAlerts, type AlertKind } from '@/lib/alerts'
import { ButtonLink, Card, Empty, PageTitle, Pill, Table, cn } from '@/components/ui'
import { ago } from '@/lib/format'

export const dynamic = 'force-dynamic'

type SP = { tipo?: string }

export default async function AlertsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireSession()
  const { tipo } = await searchParams
  const all = await collectAlerts()
  const kind = tipo && tipo in ALERT_KIND_LABEL ? (tipo as AlertKind) : null
  const alerts = kind ? all.filter((a) => a.kind === kind) : all
  const critical = all.filter((a) => a.level === 'critical').length
  const tabs: [string | null, string, number][] = [
    [null, 'Todas', all.length],
    ...Object.entries(ALERT_KIND_LABEL).map(([k, v]) => [k, v, all.filter((a) => a.kind === k).length] as [string, string, number]),
  ]
  return (
    <>
      <PageTitle title="Alertas" sub={all.length ? `${all.length} abiertas · ${critical} críticas` : 'Nada que atender ahora mismo'} />
      <nav aria-label="Tipos de alerta" className="mb-6 inline-flex flex-wrap gap-1 rounded-2xl border border-line bg-panel p-1.5">
        {tabs.map(([k, label, n]) => (
          <Link key={label} href={k ? `/alertas?tipo=${k}` : '/alertas'} aria-current={kind === k ? 'page' : undefined}
            className={cn('rounded-xl px-5 py-2.5 text-base font-medium transition-colors', kind === k ? 'bg-accent text-on-accent shadow-sm' : 'text-muted hover:bg-accent-soft hover:text-ink')}>
            {label} <span className="num">{n}</span>
          </Link>
        ))}
      </nav>
      <Card>
        {alerts.length === 0 ? <Empty title="Sin alertas en esta vista">Las webs, los servidores y las dependencias de esta vista están en orden.</Empty> : (
          <Table head={['Gravedad', 'Tipo', 'Elemento', 'Qué pasa', 'Desde', '']}>
            {alerts.map((a) => (
              <tr key={a.key}>
                <td><Pill tone={a.level === 'critical' ? 'bad' : 'warn'}>{a.level === 'critical' ? 'Crítica' : 'Aviso'}</Pill></td>
                <td className="text-muted">{ALERT_KIND_LABEL[a.kind]}</td>
                <td className="font-semibold"><Link href={a.href} className="text-accent-strong hover:underline">{a.title}</Link></td>
                <td>{a.detail}</td>
                <td className="whitespace-nowrap text-sm text-muted">{a.at ? ago(a.at) : '—'}</td>
                <td className="text-right"><ButtonLink href={a.href} size="sm">Ver<ArrowRight className="size-4" aria-hidden /></ButtonLink></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  )
}
