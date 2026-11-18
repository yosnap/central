/** Consultas de clientes que comparten la API v1 y el MCP. */
import { prisma } from '../prisma'

/** Clientes con su contacto y el número de proyectos (sin excluidos) y webs. */
export async function listClients() {
  const rows = await prisma.client.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { projects: { where: { excluded: false } }, websites: true } } } })
  return rows.map((c) => ({
    id: c.id, name: c.name, company: c.company, email: c.email, phone: c.phone, taxId: c.taxId, address: c.address,
    projects: c._count.projects, websites: c._count.websites, createdAt: c.createdAt, updatedAt: c.updatedAt,
  }))
}

/** Ficha de un cliente: contacto, proyectos, webs y sus últimas notas. */
export async function getClient(id: string) {
  const c = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: { where: { excluded: false }, orderBy: { name: 'asc' }, select: { id: true, name: true, kind: true, status: true, phase: true, version: true, repoUrl: true, lastActivityAt: true } },
      websites: { orderBy: { url: 'asc' }, select: { id: true, url: true, label: true, kind: true, lastStatus: true, lastCode: true, lastMs: true, lastCheckedAt: true, sslDaysLeft: true } },
      notes: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, body: true, pinned: true, source: true, createdAt: true } },
    },
  })
  if (!c) return null
  return {
    id: c.id, name: c.name, company: c.company, email: c.email, phone: c.phone, taxId: c.taxId, address: c.address,
    createdAt: c.createdAt, updatedAt: c.updatedAt, projects: c.projects, websites: c.websites, notes: c.notes,
  }
}
