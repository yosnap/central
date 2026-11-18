/** Proyectos: consultas comunes de la API v1 y el MCP. */
import type { Prisma } from '../../generated/prisma/client'
import { prisma } from '../prisma'

export const PROJECT_KINDS = ['CLIENT', 'OWN', 'TRAINING', 'EXPERIMENT'] as const
export const PROJECT_STATUSES = ['ACTIVE', 'MAINTENANCE', 'DORMANT', 'ARCHIVED'] as const

export type ProjectFilter = {
  kind?: (typeof PROJECT_KINDS)[number]
  status?: (typeof PROJECT_STATUSES)[number]
  /** Nombre (o parte) del cliente. */
  client?: string
  /** Texto en el nombre o tecnología del stack. */
  query?: string
  limit?: number
  /** Id del último proyecto de la página anterior. */
  cursor?: string
}

/** Error de cursor: el proyecto que lo marcaba ya no está en la lista. */
export class CursorError extends Error {}

/**
 * Proyectos (sin excluidos) del más al menos activo, los que no tienen actividad primero (como siempre ha devuelto
 * el MCP) y el id como desempate. Devuelve `limit` filas y el cursor de la siguiente página.
 * La página siguiente se pide por posición (keyset) escrita a mano, porque el cursor de Prisma no trata bien el
 * NULL de `lastActivityAt`: sin esto una página que termina en un proyecto sin actividad corta o repite la lista.
 */
export async function listProjects({ kind, status, client, query, limit = 50, cursor }: ProjectFilter = {}) {
  const filter: Prisma.ProjectWhereInput = {
    excluded: false,
    ...(kind ? { kind } : {}), ...(status ? { status } : {}),
    ...(client ? { client: { name: { contains: client, mode: 'insensitive' } } } : {}),
    ...(query ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { stack: { has: query } }] } : {}),
  }
  let after: Prisma.ProjectWhereInput = {}
  if (cursor) {
    const c = await prisma.project.findFirst({ where: { AND: [filter, { id: cursor }] }, select: { id: true, lastActivityAt: true } })
    if (!c) throw new CursorError('El cursor no corresponde a ningún proyecto de esta lista')
    after = c.lastActivityAt
      ? { OR: [{ lastActivityAt: { lt: c.lastActivityAt } }, { lastActivityAt: c.lastActivityAt, id: { gt: c.id } }] }
      : { OR: [{ lastActivityAt: null, id: { gt: c.id } }, { lastActivityAt: { not: null } }] }
  }
  const rows = await prisma.project.findMany({
    where: { AND: [filter, after] },
    orderBy: [{ lastActivityAt: { sort: 'desc', nulls: 'first' } }, { id: 'asc' }], take: limit + 1, include: { client: true },
  })
  const page = rows.slice(0, limit)
  return {
    projects: page.map((p) => ({ id: p.id, name: p.name, type: p.type ?? p.suggestedType, platform: p.platform, kind: p.kind, status: p.status, phase: p.phase, client: p.client?.name, version: p.version, framework: p.framework, stack: p.stack, repo: p.repoUrl, lastActivity: p.lastActivityAt, uncommitted: p.uncommitted })),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  }
}

/** Ficha completa de un proyecto: repositorio, ubicaciones en disco, servicios, webs y últimas notas. */
export function getProject(id: string) {
  return prisma.project.findUnique({ where: { id }, include: { client: true, locations: true, websites: true, services: true, notes: { orderBy: { createdAt: 'desc' }, take: 20 } } })
}

/** La ficha sin el token del monitor push de Uptime Kuma, para darla fuera de Central. */
export function publicProject(p: NonNullable<Awaited<ReturnType<typeof getProject>>>) {
  const { kumaPushToken: _token, ...rest } = p
  return rest
}
