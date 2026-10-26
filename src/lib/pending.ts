import { prisma } from './prisma'
import { CHECK_SELECT, NEEDS_INFO_WHERE, projectIssues } from './completeness'

/** Número de proyectos activos o en mantenimiento con información pendiente (para el aviso de la navegación). */
export async function pendingCount() {
  const ps = await prisma.project.findMany({ where: { ...NEEDS_INFO_WHERE, status: { in: ['ACTIVE', 'MAINTENANCE'] } }, select: CHECK_SELECT })
  const gone = await prisma.project.count({ where: { excluded: false, goneAt: { not: null } } })
  return { total: ps.filter((p) => projectIssues(p).length).length + gone, fresh: ps.filter((p) => !p.reviewedAt).length, gone }
}
