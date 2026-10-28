'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from './prisma'
import { requireSession } from './session'

/** Actualiza los monitores de Uptime Kuma sin esperar ni romper la acción si no está configurado. */
const kumaInBackground = () => import('./kuma').then((k) => k.syncKuma()).catch(() => {})

const TYPES = ['WEB_SITE', 'WEB_APP', 'ECOMMERCE', 'API', 'ADDON', 'PLUGIN', 'MOBILE_APP', 'DESKTOP_APP', 'BROWSER_EXTENSION', 'LIBRARY', 'SKILL', 'AUTOMATION', 'CONTENT'] as const
const PLATFORMS = ['WORDPRESS', 'WOOCOMMERCE', 'PRESTASHOP', 'SHOPIFY', 'N8N', 'CHROME', 'ELEMENTOR', 'OTHER'] as const

const Classification = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(['CLIENT', 'OWN', 'TRAINING', 'EXPERIMENT']),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'DORMANT', 'ARCHIVED']),
  statusLocked: z.coerce.boolean().optional(),
  phase: z.string().max(80).optional(),
  client: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  type: z.enum(TYPES).or(z.literal('')).optional(),
  platform: z.enum(PLATFORMS).or(z.literal('')).optional(),
  parentId: z.string().optional(),
})

export async function saveClassification(form: FormData) {
  await requireSession()
  const d = Classification.parse(Object.fromEntries(form))
  const clientName = d.client?.trim()
  const client = clientName ? await prisma.client.upsert({ where: { name: clientName }, update: {}, create: { name: clientName } }) : null
  await prisma.project.update({
    where: { id: d.id },
    data: {
      name: d.name, kind: d.kind, status: d.status, statusLocked: !!d.statusLocked, phase: d.phase?.trim() || null,
      description: d.description?.trim() || null, clientId: client?.id ?? null, reviewedAt: new Date(),
      type: d.type || null, platform: d.platform || null,
      // un proyecto no puede pertenecer a sí mismo
      parentId: d.parentId && d.parentId !== d.id ? d.parentId : null,
    },
  })
  revalidatePath(`/proyectos/${d.id}`)
  revalidatePath('/pendientes')
}

const ServiceRow = z.object({
  id: z.string().optional(),
  name: z.string().trim().max(60).optional(),
  environment: z.enum(['production', 'staging', 'development']).default('production'),
  url: z.string().trim().max(500).optional(),
  hosting: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  versionPath: z.string().trim().max(200).regex(/^$|^\/\S*$/).optional(),
  serverId: z.string().trim().max(40).optional(),
  monitor: z.coerce.boolean().optional(),
  remove: z.coerce.boolean().optional(),
})

const Deploy = z.object({
  id: z.string(),
  deployStatus: z.enum(['UNKNOWN', 'NOT_DEPLOYED', 'STAGING', 'PRODUCTION', 'RETIRED']),
  hosting: z.string().trim().max(120).optional(),
  deployedVersion: z.string().trim().max(40).optional(),
})

const normUrl = (u?: string) => (!u ? null : /^https?:\/\//i.test(u) ? u : `https://${u}`)

/** Lee filas "svc.<n>.<campo>" del formulario. */
function readRows(form: FormData) {
  const rows = new Map<string, Record<string, string>>()
  for (const [k, v] of form.entries()) {
    const m = k.match(/^svc\.(\d+)\.(\w+)$/)
    if (!m) continue
    const r = rows.get(m[1]) ?? {}
    r[m[2]] = String(v)
    rows.set(m[1], r)
  }
  return [...rows.entries()].sort(([a], [b]) => Number(a) - Number(b)).map(([, r]) => ServiceRow.parse(r))
}

export async function saveDeployment(form: FormData) {
  await requireSession()
  const d = Deploy.parse({ id: form.get('id'), deployStatus: form.get('deployStatus'), hosting: form.get('hosting') ?? undefined, deployedVersion: form.get('deployedVersion') ?? undefined })
  const project = await prisma.project.update({
    where: { id: d.id },
    data: { deployStatus: d.deployStatus, hosting: d.hosting || null, deployedVersion: d.deployedVersion || null, reviewedAt: new Date() },
  })
  const rows = readRows(form)
  let position = 0
  for (const r of rows) {
    if (r.id && r.remove) {
      await prisma.projectService.delete({ where: { id: r.id } })
      continue
    }
    if (!r.id && !r.name && !r.url) continue // fila vacía
    const url = normUrl(r.url)
    const monitor = !!r.monitor
    let websiteId: string | null = null
    if (url && monitor) {
      const site = await prisma.website.upsert({
        where: { url },
        update: { projectId: project.id, clientId: project.clientId ?? undefined, monitored: true },
        create: {
          url, projectId: project.id, clientId: project.clientId, monitored: true,
          kind: project.kind === 'CLIENT' ? 'CLIENT' : 'OWN',
          label: `${project.name} · ${r.name || 'web'}`,
        },
      })
      websiteId = site.id
    }
    const data = { name: r.name || 'web', environment: r.environment, url, hosting: r.hosting || null, notes: r.notes || null, versionPath: r.versionPath || null, serverId: r.serverId || null, monitor, websiteId, position: position++ }
    // un mismo Website solo puede estar ligado a un servicio
    if (websiteId) await prisma.projectService.updateMany({ where: { websiteId, NOT: r.id ? { id: r.id } : undefined }, data: { websiteId: null } })
    if (r.id) await prisma.projectService.update({ where: { id: r.id }, data })
    else await prisma.projectService.create({ data: { ...data, projectId: project.id } })
  }
  revalidatePath(`/proyectos/${d.id}`)
  revalidatePath('/pendientes')
  revalidatePath('/webs')
  // hosting = uno de tus servidores: sus servicios sin servidor pasan a estar en él
  const hostServer = d.hosting ? await prisma.server.findUnique({ where: { name: d.hosting }, select: { id: true } }) : null
  if (hostServer) await prisma.projectService.updateMany({ where: { projectId: d.id, serverId: null }, data: { serverId: hostServer.id } })
  const serverIds = new Set([...rows.map((r) => r.serverId), hostServer?.id].filter((x): x is string => !!x))
  revalidatePath('/servidores', 'layout')
  void kumaInBackground()
  // con el servidor elegido, Central busca su contenedor
  void import('./servers/match').then(async (m) => { for (const id of serverIds) await m.matchContainers(id) }).catch(() => {})
}

export async function markReviewed(form: FormData) {
  await requireSession()
  const id = String(form.get('id'))
  await prisma.project.update({ where: { id }, data: { reviewedAt: new Date() } })
  revalidatePath(`/proyectos/${id}`)
  revalidatePath('/pendientes')
}

export async function addNote(form: FormData) {
  await requireSession()
  const id = String(form.get('id'))
  const body = String(form.get('body') ?? '').trim()
  if (body) await prisma.note.create({ data: { body, projectId: id, source: 'app' } })
  revalidatePath(`/proyectos/${id}`)
}

const Video = z.object({ id: z.string(), title: z.string().trim().min(1).max(200), url: z.string().trim().url(), purpose: z.enum(['DEMO', 'SALES', 'MARKETING', 'TUTORIAL']) })

export async function addVideo(form: FormData) {
  await requireSession()
  const d = Video.parse(Object.fromEntries(form))
  await prisma.projectVideo.upsert({
    where: { projectId_url: { projectId: d.id, url: d.url } },
    update: { title: d.title, purpose: d.purpose },
    create: { projectId: d.id, title: d.title, url: d.url, purpose: d.purpose, manual: true },
  })
  revalidatePath(`/proyectos/${d.id}`)
}

export async function removeVideo(form: FormData) {
  await requireSession()
  const v = await prisma.projectVideo.delete({ where: { id: String(form.get('videoId')) } })
  revalidatePath(`/proyectos/${v.projectId}`)
}

// Repositorio escrito a mano: queda fijado y el escáner no lo cambia. Vacío lo devuelve al escáner.
const Repo = z.object({ id: z.string(), repoUrl: z.string().trim().max(500).regex(/^$|^(https?:\/\/|git@|ssh:\/\/)\S+$/) })

export async function saveRepo(form: FormData) {
  await requireSession()
  const d = Repo.parse(Object.fromEntries(form))
  await prisma.project.update({ where: { id: d.id }, data: { repoUrl: d.repoUrl || null, repoLocked: !!d.repoUrl } })
  revalidatePath(`/proyectos/${d.id}`)
}

// Excluir: el proyecto sale de listados, avisos y MCP, y el escáner no lo vuelve a meter.
const IdOnly = z.object({ id: z.string() })

export async function excludeProject(form: FormData) {
  await requireSession()
  const { id } = IdOnly.parse(Object.fromEntries(form))
  await prisma.project.update({ where: { id }, data: { excluded: true, excludedAt: new Date() } })
  revalidatePath('/', 'layout')
}

export async function includeProject(form: FormData) {
  await requireSession()
  const { id } = IdOnly.parse(Object.fromEntries(form))
  await prisma.project.update({ where: { id }, data: { excluded: false, excludedAt: null } })
  revalidatePath('/', 'layout')
}

// --- Qué es cada proyecto: propuestas del escáner, dominios e instalaciones ---

/** Acepta el tipo (y la plataforma) que propone el escáner. */
export async function acceptSuggestion(form: FormData) {
  await requireSession()
  const { id } = IdOnly.parse(Object.fromEntries(form))
  const p = await prisma.project.findUniqueOrThrow({ where: { id }, select: { suggestedType: true, suggestedPlatform: true, platform: true } })
  if (!p.suggestedType) throw new Error('Sin propuesta')
  await prisma.project.update({ where: { id }, data: { type: p.suggestedType, platform: p.platform ?? p.suggestedPlatform } })
  revalidatePath('/', 'layout')
}

/** Acepta de una vez los tipos propuestos de los proyectos que aún no tienen tipo. */
export async function acceptAllSuggestions() {
  await requireSession()
  const ps = await prisma.project.findMany({ where: { excluded: false, type: null, suggestedType: { not: null } }, select: { id: true, suggestedType: true, suggestedPlatform: true, platform: true } })
  await prisma.$transaction(ps.map((p) => prisma.project.update({ where: { id: p.id }, data: { type: p.suggestedType, platform: p.platform ?? p.suggestedPlatform } })))
  revalidatePath('/', 'layout')
}

/** Da de alta un dominio sugerido como servicio de producción vigilado. */
export async function addSuggestedDomain(form: FormData) {
  await requireSession()
  const d = z.object({ id: z.string(), domain: z.string().trim().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i) }).parse(Object.fromEntries(form))
  const project = await prisma.project.findUniqueOrThrow({ where: { id: d.id }, include: { _count: { select: { services: true } } } })
  const url = `https://${d.domain.toLowerCase()}`
  const site = await prisma.website.upsert({
    where: { url },
    update: { projectId: project.id, clientId: project.clientId ?? undefined, monitored: true },
    create: { url, projectId: project.id, clientId: project.clientId, monitored: true, kind: project.kind === 'CLIENT' ? 'CLIENT' : 'OWN', label: `${project.name} · web` },
  })
  await prisma.projectService.updateMany({ where: { websiteId: site.id }, data: { websiteId: null } })
  await prisma.projectService.create({ data: { projectId: project.id, name: 'web', environment: 'production', url, monitor: true, websiteId: site.id, position: project._count.services } })
  revalidatePath(`/proyectos/${d.id}`)
  revalidatePath('/webs')
  void kumaInBackground()
}

const InstallationForm = z.object({
  id: z.string(),
  website: z.string().trim().min(1).max(500),
  version: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(300).optional(),
})

/** Registra en qué web está instalado un plugin o addon. La web puede ser una de Central o una URL nueva. */
export async function addInstallation(form: FormData) {
  await requireSession()
  const d = InstallationForm.parse(Object.fromEntries(form))
  const existing = await prisma.website.findUnique({ where: { id: d.website } })
  const site = existing ?? await (async () => {
    const raw = d.website.toLowerCase()
    const url = /^https?:\/\//.test(raw) ? raw : `https://${raw}`
    return prisma.website.upsert({ where: { url }, update: {}, create: { url, monitored: false, kind: 'CLIENT' } })
  })()
  await prisma.installation.upsert({
    where: { projectId_websiteId: { projectId: d.id, websiteId: site.id } },
    update: { version: d.version || null, notes: d.notes || null },
    create: { projectId: d.id, websiteId: site.id, version: d.version || null, notes: d.notes || null },
  })
  revalidatePath(`/proyectos/${d.id}`)
}

export async function removeInstallation(form: FormData) {
  await requireSession()
  const { id } = IdOnly.parse(Object.fromEntries(form))
  const i = await prisma.installation.delete({ where: { id } })
  revalidatePath(`/proyectos/${i.projectId}`)
}
