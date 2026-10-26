import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card, Pill, Table } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'

/** Últimos despliegues detectados de un proyecto o de un servidor. */
export async function DeploymentsCard({ projectId, serverId, className }: { projectId?: string; serverId?: string; className?: string }) {
  const rows = await prisma.deployment.findMany({
    where: projectId ? { projectService: { projectId } } : { serverId },
    orderBy: { at: 'desc' },
    take: 12,
    include: { server: { select: { id: true, name: true } }, projectService: { select: { name: true, project: { select: { id: true, name: true } } } } },
  })
  return (
    <Card title="Despliegues" className={className} note="Central los detecta solo cuando un contenedor vuelve a arrancar o un servicio de Swarm se actualiza, y lee entonces la versión nueva.">
      {rows.length === 0 ? <p className="text-muted">Aún no se ha detectado ninguno.</p> : (
        <Table head={['Cuándo', projectId ? 'Servicio' : 'Proyecto', 'Versión', projectId ? 'Servidor' : 'Servicio Docker']}>
          {rows.map((d) => (
            <tr key={d.id}>
              <td className="whitespace-nowrap">{fmtDateTime(d.at)}</td>
              <td>{projectId ? d.projectService?.name ?? d.containerName : d.projectService ? <Link href={`/proyectos/${d.projectService.project.id}`} className="text-accent-strong hover:underline">{d.projectService.project.name}</Link> : <span className="text-muted">Sin proyecto</span>}</td>
              <td className="num whitespace-nowrap">
                {d.version ? <>{d.previousVersion && d.previousVersion !== d.version && <span className="text-muted">{d.previousVersion} → </span>}<Pill tone="ok">{d.version}</Pill></> : <span className="text-muted">sin versión</span>}
              </td>
              <td className="text-muted">{projectId ? <Link href={`/servidores/${d.server.id}`} className="hover:underline">{d.server.name}</Link> : d.containerName}</td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  )
}
