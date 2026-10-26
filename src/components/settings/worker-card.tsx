import { prisma } from '@/lib/prisma'
import { macOnline } from '@/lib/worker'
import { Card, Pill, Table } from '@/components/ui'
import { ago, fmtDateTime } from '@/lib/format'

const TYPE = { assistant: 'Asistente de presupuestos', scan: 'Escaneo de carpetas' } as Record<string, string>
const STATUS = { pending: ['En cola', 'muted'], running: ['En marcha', 'accent'], done: ['Hecho', 'ok'], error: ['Error', 'bad'] } as const

/** Con Central en producción: si el Mac está conectado, qué carpetas deja escanear y los últimos trabajos. */
export async function WorkerCard() {
  const [mac, jobs] = await Promise.all([macOnline(), prisma.workerJob.findMany({ orderBy: { createdAt: 'desc' }, take: 8 })])
  return (
    <Card title="Trabajador del Mac" className="xl:col-span-2"
      note="Lo que solo puede hacer tu Mac (el asistente con Claude Code y el escaneo de carpetas) lo hace el trabajador: solo sale del Mac hacia Central, recoge los trabajos y devuelve el resultado.">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {mac.online ? <Pill tone="ok">Conectado{mac.hostname ? ` · ${mac.hostname}` : ''}</Pill> : <Pill tone="warn">Sin conexión{mac.lastSeenAt ? ` · visto ${ago(mac.lastSeenAt)}` : ''}</Pill>}
        {mac.lastSeenAt && <span className="text-sm text-muted">Último latido {fmtDateTime(mac.lastSeenAt)}</span>}
      </div>
      <p className="mb-1 font-medium">Carpetas que deja escanear</p>
      {mac.roots.length ? <ul className="mb-4 list-disc pl-6 font-mono text-sm">{mac.roots.map((r) => <li key={r}>{r}</li>)}</ul>
        : <p className="mb-4 text-sm text-muted">Ninguna todavía. Se eligen en el Mac, con <code className="font-mono">CENTRAL_WORKER_ROOTS</code> del trabajador; desde aquí no se pueden cambiar.</p>}
      {jobs.length > 0 && (
        <Table head={['Trabajo', 'Estado', 'Pedido', 'Detalle']}>
          {jobs.map((j) => {
            const [label, tone] = STATUS[j.status as keyof typeof STATUS] ?? [j.status, 'muted']
            return (
              <tr key={j.id}>
                <td>{TYPE[j.type] ?? j.type}</td>
                <td><Pill tone={tone}>{label}</Pill></td>
                <td className="whitespace-nowrap text-muted">{fmtDateTime(j.createdAt)}</td>
                <td className="text-sm text-muted">{j.error ?? (j.finishedAt && j.startedAt ? `${Math.round((j.finishedAt.getTime() - j.startedAt.getTime()) / 1000)} s` : '—')}</td>
              </tr>
            )
          })}
        </Table>
      )}
    </Card>
  )
}
