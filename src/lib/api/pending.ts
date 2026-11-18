/** Proyectos con información pendiente: consulta común de la API v1 y el MCP. */
import { prisma } from '../prisma'
import { CHECK_SELECT, NEEDS_INFO_WHERE, projectIssues } from '../completeness'

export async function listPending() {
  const ps = await prisma.project.findMany({ where: { ...NEEDS_INFO_WHERE, status: { in: ['ACTIVE', 'MAINTENANCE'] } }, select: CHECK_SELECT })
  return ps.map((p) => ({ id: p.id, name: p.name, client: p.client?.name, missing: projectIssues(p).map((i) => i.label) })).filter((p) => p.missing.length)
}
