/**
 * Enlace entre un servicio Docker y un proyecto, el mismo desde Servidores, Pendientes y la ficha del proyecto.
 * Destino: «svc:<id>» = un servicio de proyecto que ya existe; «prj:<id>» = un proyecto (se usa el servicio con su
 * dominio o nombre, o se crea uno); vacío = volver al emparejado automático.
 */
import { prisma } from '../prisma'
import { hostOf, matchContainers } from './match'
import { refreshServiceVersion } from '../deploy-version'
import { ROLE_LABEL } from './role'

/** Opciones para elegir proyecto: cada servicio existente y, por proyecto, «nuevo servicio». */
export async function linkOptions() {
  const projects = await prisma.project.findMany({
    where: { excluded: false },
    select: { id: true, name: true, services: { select: { id: true, name: true, environment: true, url: true }, orderBy: { position: 'asc' } } },
    orderBy: { name: 'asc' },
  })
  return [
    { value: '', label: 'Automático (por dominio y nombre)' },
    ...projects.flatMap((p) => [
      ...p.services.map((s) => ({ value: `svc:${s.id}`, label: `${p.name} · ${s.name}${s.environment === 'production' ? '' : ` (${s.environment})`}`, hint: s.url?.replace(/^https?:\/\//, '') ?? undefined })),
      { value: `prj:${p.id}`, label: p.services.length ? `${p.name} · nuevo servicio` : p.name, hint: p.services.length ? undefined : 'sin servicios: se crea uno' },
    ]),
  ]
}

const SERVICE_NAME: Record<string, string> = { database: 'base de datos', cache: 'caché', queue: 'cola', automation: 'n8n', storage: 'almacenamiento' }

/** Pruebas si el dominio lo dice (staging., dev., test., preview., qa.); si no, producción. */
export const envFromDomain = (d: string | undefined) => (d && /(^|[.-])(staging|stage|stg|dev|test|preview|qa|pre)[.-]/.test(d) ? 'staging' : 'production')

export async function linkContainer(containerId: string, target: string, environment?: 'production' | 'staging' | 'development') {
  const c = await prisma.serverContainer.findUniqueOrThrow({ where: { id: containerId } })
  if (!target) {
    await prisma.serverContainer.update({ where: { id: c.id }, data: { projectServiceId: null, matchManual: false } })
    await matchContainers(c.serverId)
    return
  }
  let serviceId: string
  if (target.startsWith('svc:')) {
    serviceId = target.slice(4)
  } else if (target.startsWith('prj:')) {
    const project = await prisma.project.findUniqueOrThrow({ where: { id: target.slice(4) }, include: { services: true } })
    const hosts = new Set(c.domains)
    const name = c.role && c.role !== 'app' && c.role !== 'other' ? SERVICE_NAME[c.role] ?? ROLE_LABEL[c.role].toLowerCase() : 'web'
    const env = environment ?? envFromDomain(c.domains[0])
    const existing = project.services.find((s) => s.url && hosts.has(hostOf(s.url) ?? '')) ?? project.services.find((s) => s.name === name && s.environment === env && !s.serverId)
    if (existing) serviceId = existing.id
    else {
      const url = c.domains[0] ? `https://${c.domains[0]}` : null
      // con dominio, se vigila como cualquier servicio con URL (Webs y Uptime Kuma)
      const site = url ? await prisma.website.upsert({
        where: { url },
        update: { projectId: project.id },
        create: { url, projectId: project.id, clientId: project.clientId, monitored: true, kind: project.kind === 'CLIENT' ? 'CLIENT' : 'OWN', label: `${project.name} · ${name}` },
      }) : null
      if (site) await prisma.projectService.updateMany({ where: { websiteId: site.id }, data: { websiteId: null } })
      const created = await prisma.projectService.create({
        data: { projectId: project.id, name, environment: env, url, serverId: c.serverId, monitor: !!url, websiteId: site?.id ?? null, position: project.services.length, notes: `Creado al enlazar el servicio Docker ${c.name}` },
      })
      serviceId = created.id
      if (site) void import('../kuma').then((k) => k.syncKuma()).catch(() => {})
    }
  } else throw new Error('Destino no válido')
  await prisma.projectService.update({ where: { id: serviceId }, data: { serverId: c.serverId } })
  await prisma.serverContainer.update({ where: { id: c.id }, data: { projectServiceId: serviceId, matchManual: true } })
  // la versión de lo que corre ahí pasa al servicio (y, si es producción, al proyecto)
  await refreshServiceVersion(serviceId, { force: true })
}
