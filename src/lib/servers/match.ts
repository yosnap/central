/**
 * Reconocer qué es de quién: en qué servidor está cada servicio de proyecto (por los dominios que sirve su proxy)
 * y qué contenedor o servicio Docker le corresponde (por nombre). Lo que se empareja a mano no se toca.
 */
import { prisma } from '../prisma'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '')
export const hostOf = (url: string) => { try { return new URL(/^https?:\/\//.test(url) ? url : `https://${url}`).hostname.toLowerCase() } catch { return null } }

/** Servicios sin servidor cuyo dominio sirve un único servidor: se les asigna ese servidor. */
export async function assignServersByDomain() {
  const servers = await prisma.server.findMany({ select: { id: true, snapshot: true } })
  const byHost = new Map<string, string[]>()
  for (const s of servers) for (const d of ((s.snapshot as { domains?: string[] } | null)?.domains ?? [])) byHost.set(d, [...(byHost.get(d) ?? []), s.id])
  const services = await prisma.projectService.findMany({ where: { serverId: null, url: { not: null } }, select: { id: true, url: true } })
  let n = 0
  for (const svc of services) {
    const ids = byHost.get(hostOf(svc.url!) ?? '') ?? []
    if (ids.length !== 1) continue
    await prisma.projectService.update({ where: { id: svc.id }, data: { serverId: ids[0] } })
    n++
  }
  return n
}

/** Empareja los contenedores de un servidor con los servicios de proyecto asignados a él. */
export async function matchContainers(serverId: string) {
  const [containers, services] = await Promise.all([
    prisma.serverContainer.findMany({ where: { serverId } }),
    prisma.projectService.findMany({ where: { serverId }, select: { id: true, name: true, url: true, project: { select: { name: true, slug: true } } } }),
  ])
  const manual = new Set(containers.filter((c) => c.matchManual && c.projectServiceId).map((c) => c.projectServiceId))
  const wanted = new Map<string, string | null>() // contenedor → servicio
  for (const svc of services) {
    if (manual.has(svc.id)) continue
    const project = norm(svc.project.name)
    const slugTail = norm(svc.project.slug.split('/').pop() ?? '')
    const service = norm(svc.name)
    const host = svc.url ? hostOf(svc.url) : null
    let best: { id: string; score: number } | null = null, tie = false
    for (const c of containers) {
      if (c.matchManual) continue
      // Easypanel nombra «proyecto_servicio», Compose «proyecto-servicio-1» y Dokploy «proyecto-app-xxxx»
      const name = norm(c.name)
      let score = 0
      if (host && c.domains.includes(host)) score += 5 // su proxy sirve el dominio del servicio
      if (project.length >= 3 && name.includes(project)) score += 2
      else if (slugTail.length >= 3 && name.includes(slugTail)) score += 2
      if (score < 5 && c.role && c.role !== 'app' && c.role !== 'other' && !/^(db|database|redis|cache)/.test(service)) score -= 1 // una web no es su base de datos
      if (score && service.length >= 2 && name.includes(service)) score += 1
      if (score < 2) continue
      if (!best || score > best.score) { best = { id: c.id, score }; tie = false }
      else if (score === best.score) tie = true
    }
    if (best && !tie) wanted.set(best.id, svc.id)
  }
  for (const c of containers) {
    if (c.matchManual) continue
    const next = wanted.get(c.id) ?? null
    if (next !== c.projectServiceId) await prisma.serverContainer.update({ where: { id: c.id }, data: { projectServiceId: next } })
  }
}
