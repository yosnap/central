/**
 * Nombre de la web de un servicio de proyecto («Proyecto · api», «Proyecto · web (pruebas)») y cómo se vigila según
 * qué es. Un único sitio para Webs, Uptime Kuma y el comprobador propio.
 */
import { prisma } from './prisma'

const ENV_SUFFIX: Record<string, string> = { staging: ' (pruebas)', development: ' (local)' }

export const serviceSiteLabel = (project: string, service: string, environment: string) => `${project} · ${service}${ENV_SUFFIX[environment] ?? ''}`

/** Una API o un backend no tiene página en «/»: un 404 ahí también dice que el servidor responde. */
export const isApiService = (name: string | null | undefined) => /\b(api|backend|server)\b/i.test(name ?? '')

/**
 * Pone al día las webs de los servicios: nombre (si se renombró el servicio o el proyecto) y si se vigilan. Una web que
 * quedó suelta (antes se desligaba al quitar «Vigilar») vuelve a su servicio por la URL.
 */
export async function syncWebsiteLabels() {
  const loose = await prisma.projectService.findMany({ where: { websiteId: null, url: { not: null } }, select: { id: true, url: true, monitor: true } })
  for (const s of loose) {
    const site = await prisma.website.findUnique({ where: { url: s.url! }, select: { id: true, service: { select: { id: true } } } })
    if (site && !site.service) {
      await prisma.projectService.update({ where: { id: s.id }, data: { websiteId: site.id } })
      await prisma.website.update({ where: { id: site.id }, data: { monitored: s.monitor } })
    }
  }
  const services = await prisma.projectService.findMany({
    where: { websiteId: { not: null } },
    select: { name: true, environment: true, monitor: true, project: { select: { name: true } }, website: { select: { id: true, label: true, monitored: true } } },
  })
  let changed = 0
  for (const s of services) {
    const label = serviceSiteLabel(s.project.name, s.name, s.environment)
    if (s.website && (s.website.label !== label || s.website.monitored !== s.monitor)) {
      await prisma.website.update({ where: { id: s.website.id }, data: { label, monitored: s.monitor } })
      changed++
    }
  }
  return changed
}
