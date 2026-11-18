/** Webs monitorizadas: consulta común de la API v1 y el MCP. */
import { prisma } from '../prisma'

export type WebsiteFilter = { kind?: 'CLIENT' | 'OWN' | 'CENTRAL'; onlyDown?: boolean }

export async function listWebsites({ kind, onlyDown = false }: WebsiteFilter = {}) {
  const rows = await prisma.website.findMany({ where: { ...(kind ? { kind } : {}), ...(onlyDown ? { lastStatus: 'down' } : {}) }, include: { client: true }, orderBy: { url: 'asc' } })
  return rows.map((w) => ({ id: w.id, url: w.url, kind: w.kind, client: w.client?.name, status: w.lastStatus, code: w.lastCode, ms: w.lastMs, checkedAt: w.lastCheckedAt }))
}
