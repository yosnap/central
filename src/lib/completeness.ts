/**
 * Reglas de "información pendiente" de un proyecto.
 * Un único sitio para decidir qué falta: el contador de la navegación, la página Pendientes
 * y el aviso de la ficha usan esto. Para pedir un dato nuevo, añade una regla aquí.
 */
import type { DeployStatus, Platform, Prisma, ProjectKind, ProjectStatus, ProjectType } from '@/generated/prisma/client'

export interface ProjectForCheck {
  kind: ProjectKind
  status: ProjectStatus
  reviewedAt: Date | null
  deployStatus: DeployStatus
  clientId: string | null
  description: string | null
  phase: string | null
  hosting: string | null
  type: ProjectType | null
  platform: Platform | null
  parentId: string | null
  repoUrl: string | null
  _count: { services: number }
}

/** Tipos que no se despliegan por sí mismos: no se les pide despliegue, hosting ni servicios. */
export const NOT_DEPLOYED_TYPES: ProjectType[] = ['ADDON', 'PLUGIN', 'CONTENT']

export interface Issue {
  key: string
  label: string
}

export function projectIssues(p: ProjectForCheck): Issue[] {
  const out: Issue[] = []
  const deployable = !p.type || !NOT_DEPLOYED_TYPES.includes(p.type)
  const live = p.deployStatus === 'PRODUCTION' || p.deployStatus === 'STAGING'
  if (!p.reviewedAt) out.push({ key: 'new', label: 'Proyecto nuevo sin revisar' })
  if (!p.repoUrl && (p.status === 'ACTIVE' || p.status === 'MAINTENANCE')) out.push({ key: 'remote', label: 'Sin copia fuera del disco: no tiene remoto' })
  if (!p.type) out.push({ key: 'type', label: 'Falta el tipo de proyecto' })
  if (p.type === 'ADDON' && !p.parentId) out.push({ key: 'parent', label: 'Addon sin sistema al que pertenece' })
  if (p.type === 'PLUGIN' && !p.platform) out.push({ key: 'platform', label: 'Plugin sin plataforma' })
  if (deployable && p.deployStatus === 'UNKNOWN') out.push({ key: 'deploy', label: 'Falta indicar si está desplegado' })
  if (deployable && live && p._count.services === 0) out.push({ key: 'services', label: 'Faltan los dominios y servicios' })
  if (deployable && live && !p.hosting) out.push({ key: 'hosting', label: 'Falta dónde está alojado' })
  if (p.kind === 'CLIENT' && !p.clientId) out.push({ key: 'client', label: 'Falta el cliente' })
  if (!p.phase) out.push({ key: 'phase', label: 'Falta la fase' })
  if (!p.description) out.push({ key: 'description', label: 'Falta una descripción' })
  return out
}

/** Proyectos que generan avisos: de clientes o propios y no archivados. */
export const NEEDS_INFO_WHERE = { excluded: false, goneAt: null, kind: { in: ['CLIENT', 'OWN'] }, status: { not: 'ARCHIVED' } } satisfies Prisma.ProjectWhereInput

export const CHECK_SELECT = {
  id: true, name: true, kind: true, status: true, reviewedAt: true, deployStatus: true, clientId: true,
  description: true, phase: true, hosting: true, type: true, platform: true, parentId: true, suggestedType: true, repoUrl: true, lastActivityAt: true, createdAt: true,
  client: { select: { name: true } },
  _count: { select: { services: true } },
} as const satisfies Prisma.ProjectSelect

export const DEPLOY_LABEL = {
  UNKNOWN: 'Sin indicar', NOT_DEPLOYED: 'Sin desplegar', STAGING: 'En pruebas', PRODUCTION: 'En producción', RETIRED: 'Retirado',
} as const
