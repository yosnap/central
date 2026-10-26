/** Avisos de servidores para Resumen y Pendientes: en rojo o sin dato (con los proyectos afectados) y protección incompleta. */
import { prisma } from '../prisma'
import { visibleStatus } from './collect'

export async function serverAlerts() {
  const servers = await prisma.server.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, status: true, error: true, lastOkAt: true, intervalSec: true,
      services: { select: { project: { select: { id: true, name: true } } } },
      checks: { where: { ok: false }, select: { detail: true } },
    },
  })
  const all = servers.map((s) => ({ ...s, level: visibleStatus(s), projects: [...new Map(s.services.map((x) => [x.project.id, x.project])).values()] }))
  return {
    down: all.filter((s) => s.level === 'red' || s.level === 'grey'),
    unprotected: all.filter((s) => s.checks.length > 0),
  }
}
