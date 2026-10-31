/**
 * Nombre de la web de un servicio de proyecto («Proyecto · api», «Proyecto · web (pruebas)») y cómo se vigila según
 * qué es. Un único sitio para Webs, Uptime Kuma y el comprobador propio.
 */
import { prisma } from './prisma'

const ENV_SUFFIX: Record<string, string> = { staging: ' (pruebas)', development: ' (local)' }

export const serviceSiteLabel = (project: string, service: string, environment: string) => `${project} · ${service}${ENV_SUFFIX[environment] ?? ''}`

/** Una API o un backend no tiene página en «/»: un 404 ahí también dice que el servidor responde. */
export const isApiService = (name: string | null | undefined) => /\b(api|backend|server)\b/i.test(name ?? '')

/** Pone al día el nombre de las webs ligadas a un servicio (si se renombró el servicio o el proyecto). */
export async function syncWebsiteLabels() {
  const services = await prisma.projectService.findMany({
    where: { websiteId: { not: null } },
    select: { name: true, environment: true, project: { select: { name: true } }, website: { select: { id: true, label: true } } },
  })
  let changed = 0
  for (const s of services) {
    const label = serviceSiteLabel(s.project.name, s.name, s.environment)
    if (s.website && s.website.label !== label) {
      await prisma.website.update({ where: { id: s.website.id }, data: { label } })
      changed++
    }
  }
  return changed
}
