/**
 * Vista de los servidores para otras apps (CostGuard por la API, Claude por el MCP).
 * Sin rutas de clave, sin IPs conocidas ni IPs atacantes: solo estado y qué aloja cada uno.
 */
import { prisma } from '../prisma'
import { visibleStatus } from './collect'
import type { Snapshot } from './snapshot'

const INCLUDE = {
  services: { select: { id: true, name: true, environment: true, url: true, project: { select: { id: true, name: true } }, containers: { select: { name: true, state: true, detail: true } } } },
  containers: { select: { name: true, kind: true, state: true, detail: true, projectServiceId: true } },
  checks: { select: { key: true, ok: true, detail: true, fix: true } },
} as const

type Row = Awaited<ReturnType<typeof load>>[number]
const load = (where: { id?: string } = {}) => prisma.server.findMany({ where, include: INCLUDE, orderBy: { name: 'asc' } })

function shape(s: Row, detail: boolean) {
  const snap = s.snapshot as Snapshot | null
  return {
    id: s.id, name: s.name, host: s.host, sshPort: s.sshPort, provider: s.provider, panel: s.panel, panelUrl: s.panelUrl,
    status: visibleStatus(s), liveStatus: s.liveStatus, error: s.error, lastOkAt: s.lastOkAt, nextAt: s.nextAt,
    cpu: snap?.cards.cpu?.pct ?? null, memory: snap?.cards.memory?.pct ?? null, disk: snap?.cards.disk?.pct ?? null,
    services: snap?.cards.services ? { ok: snap.cards.services.ok, total: snap.cards.services.total, down: snap.cards.services.down } : null,
    protection: snap?.protection ?? null,
    projects: s.services.map((x) => ({ projectId: x.project.id, project: x.project.name, service: x.name, environment: x.environment, url: x.url, containers: x.containers })),
    ...(detail ? { cards: snap?.cards ?? null, readAt: snap?.readAt ?? null, root: snap?.root ?? null, domains: snap?.domains ?? null, containers: s.containers, checks: s.checks } : {}),
  }
}

export async function listServersPublic() { return (await load()).map((s) => shape(s, false)) }
export async function getServerPublic(id: string) { const [s] = await load({ id }); return s ? shape(s, true) : null }
