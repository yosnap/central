/** Proyectos: consultas comunes de la API v1 y el MCP. */
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

/** Proyectos (sin excluidos) del más al menos activo. Devuelve `limit` filas y el cursor de la siguiente página. */
export async function listProjects({ kind, status, client, query, limit = 50, cursor }: ProjectFilter = {}) {
  const rows = await prisma.project.findMany({
    where: {
      excluded: false,
      ...(kind ? { kind } : {}), ...(status ? { status } : {}),
      ...(client ? { client: { name: { contains: client, mode: 'insensitive' } } } : {}),
      ...(query ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { stack: { has: query } }] } : {}),
    },
    // el id desempata para que el cursor sea estable
    orderBy: [{ lastActivityAt: 'desc' }, { id: 'asc' }], take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), include: { client: true },
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
