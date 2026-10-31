'use server'

/** Servicios de un proyecto, editados uno a uno desde las pestañas de entorno de su ficha. */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from './prisma'
import { linkContainer } from './servers/link'
import { matchContainers } from './servers/match'
import { requireSession } from './session'
import { serviceSiteLabel, syncWebsiteLabels } from './website-label'

const ENV = z.enum(['production', 'staging', 'development'])
const normUrl = (u: string) => (!u ? null : /^https?:\/\//i.test(u) ? u : `https://${u}`)

async function refresh(serviceId?: string, projectId?: string) {
  const pid = projectId ?? (serviceId ? (await prisma.projectService.findUnique({ where: { id: serviceId }, select: { projectId: true } }))?.projectId : undefined)
  if (pid) revalidatePath(`/proyectos/${pid}`)
  revalidatePath('/webs')
  revalidatePath('/servidores', 'layout')
  void import('./kuma').then((k) => k.syncKuma()).catch(() => {})
}

/**
 * Con URL, el servicio tiene su web en Webs; «Vigilar» decide si se comprueba (y si está en Uptime Kuma). Sin URL, se
 * desliga. Sin «Vigilar» se queda ligada, con su nombre e historial, pero sin vigilar: no sale como caída.
 */
async function syncWebsite(serviceId: string) {
  const s = await prisma.projectService.findUniqueOrThrow({ where: { id: serviceId }, include: { project: { select: { id: true, name: true, clientId: true, kind: true } } } })
  if (!s.url) {
    if (s.websiteId) await prisma.projectService.update({ where: { id: s.id }, data: { websiteId: null } })
    return
  }
  const site = await prisma.website.upsert({
    where: { url: s.url },
    update: { projectId: s.project.id, monitored: s.monitor },
    create: { url: s.url, projectId: s.project.id, clientId: s.project.clientId, monitored: s.monitor, kind: s.project.kind === 'CLIENT' ? 'CLIENT' : 'OWN', label: serviceSiteLabel(s.project.name, s.name, s.environment) },
  })
  // un mismo Website solo puede estar ligado a un servicio
  await prisma.projectService.updateMany({ where: { websiteId: site.id, NOT: { id: s.id } }, data: { websiteId: null } })
  await prisma.projectService.update({ where: { id: s.id }, data: { websiteId: site.id } })
}

const FIELDS = {
  name: z.string().trim().min(1).max(60),
  environment: ENV,
  url: z.string().trim().max(500).transform(normUrl),
  serverId: z.string().trim().max(40).transform((v) => v || null),
  versionPath: z.string().trim().max(200).regex(/^$|^\/\S*$/, 'La ruta empieza por /, p. ej. /api/version').transform((v) => v || null),
  hosting: z.string().trim().max(120).transform((v) => v || null),
  notes: z.string().trim().max(500).transform((v) => v || null),
} as const

export async function updateServiceField(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const field = z.enum(Object.keys(FIELDS) as [keyof typeof FIELDS]).parse(form.get('field'))
  const r = FIELDS[field].safeParse(String(form.get('value') ?? ''))
  if (!r.success) return { error: r.error.issues.map((i) => i.message).join('. ') }
  await prisma.projectService.update({ where: { id }, data: { [field]: r.data } })
  if (field === 'url') await syncWebsite(id)
  if (field === 'name' || field === 'environment') await syncWebsiteLabels()
  if (field === 'serverId' && r.data) await matchContainers(r.data as string)
  await refresh(id)
}

export async function setServiceMonitor(id: string, monitor: boolean) {
  await requireSession()
  await prisma.projectService.update({ where: { id: z.string().min(1).parse(id) }, data: { monitor } })
  await syncWebsite(id)
  await refresh(id)
}

export async function deleteServiceAction(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const s = await prisma.projectService.delete({ where: { id } })
  await refresh(undefined, s.projectId)
}

export async function addServiceAction(form: FormData) {
  await requireSession()
  const d = z.object({ projectId: z.string().min(1), environment: ENV, name: z.string().trim().min(1).max(60), url: z.string().trim().max(500).optional() }).parse(Object.fromEntries(form))
  const count = await prisma.projectService.count({ where: { projectId: d.projectId } })
  const url = normUrl(d.url ?? '')
  const s = await prisma.projectService.create({ data: { projectId: d.projectId, environment: d.environment, name: d.name, url, monitor: !!url, position: count } })
  await syncWebsite(s.id)
  await refresh(s.id, d.projectId)
}

/** Añade al proyecto un servicio Docker de uno de tus servidores, con su dominio, servidor, tipo y versión. */
export async function addFromContainerAction(form: FormData) {
  await requireSession()
  const d = z.object({ projectId: z.string().min(1), containerId: z.string().min(1), environment: ENV.optional() }).parse(Object.fromEntries(form))
  await linkContainer(d.containerId, `prj:${d.projectId}`, d.environment)
  await refresh(undefined, d.projectId)
}

/** Orden de los servicios de un entorno (arrastrar y soltar en la ficha). Todos deben ser del mismo proyecto y entorno. */
export async function reorderServicesAction(ids: string[]) {
  await requireSession()
  const list = z.array(z.string().min(1).max(40)).min(1).max(100).parse(ids)
  const rows = await prisma.projectService.findMany({ where: { id: { in: list } }, select: { projectId: true, environment: true } })
  if (rows.length !== list.length || new Set(rows.map((r) => `${r.projectId}|${r.environment}`)).size !== 1) return { error: 'Servicios no válidos' }
  await prisma.$transaction(list.map((id, position) => prisma.projectService.update({ where: { id }, data: { position } })))
  revalidatePath(`/proyectos/${rows[0].projectId}`)
}
