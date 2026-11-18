/**
 * Estado y fase de un proyecto desde la API v1 (`PATCH /proyectos/{id}`).
 * Regla del escáner: con `statusLocked` el escáner no toca el estado; sin él lo recalcula en cada pasada. Por eso
 * cambiar el estado de un proyecto fijado a mano exige mandar también `statusLocked: true` (si no, 409).
 * Por la API no se archiva (archivar quita el proyecto de auditorías y alertas y borra su monitor de Uptime Kuma) ni
 * se quita `statusLocked`: sin él, el escáner podría recalcularlo como archivado (copias de seguridad) sin que nadie
 * lo vea. Las dos cosas se hacen en Central.
 */
import { z } from 'zod'
import { prisma } from '../../prisma'
import { MutationError } from './errors'
import { PROJECT_STATUSES } from '../projects'
import { VERSION_PATTERN, audit, changedData, changesOf, checkVersion, lockRow, versionOf, type MutationOptions } from './common'

export type ProjectStatusValue = (typeof PROJECT_STATUSES)[number]
/** Fase libre («Desarrollo», «Entrega»…), como en la ficha de la web. */
export const PHASE_MAX = 80

export type ProjectStatePatch = { status?: ProjectStatusValue; statusLocked?: boolean; phase?: string | null }

export const projectPatchSchema = z.strictObject({
  version: z.string().regex(VERSION_PATTERN, 'Versión no válida: usa la de la última lectura'),
  status: z.enum(PROJECT_STATUSES).refine((s) => s !== 'ARCHIVED', 'Archivar se hace en Central').optional(),
  statusLocked: z.boolean().refine((v) => v, 'Quitar el estado fijado se hace en Central: el escáner podría archivar el proyecto').optional(),
  phase: z.string().trim().max(PHASE_MAX).nullable().transform((v) => v || null).optional(),
}).refine((d) => d.status !== undefined || d.statusLocked !== undefined || d.phase !== undefined, 'Indica al menos un campo que cambiar')

type VersionFields = { name: string; kind: string; status: string; statusLocked: boolean; phase: string | null; description: string | null; clientId: string | null }

/** Versión de un proyecto: sus campos de clasificación, los que se editan a mano. */
export const projectVersion = (p: VersionFields) =>
  versionOf({ name: p.name, kind: p.kind, status: p.status, statusLocked: p.statusLocked, phase: p.phase, description: p.description, clientId: p.clientId })

const select = { id: true, name: true, kind: true, status: true, statusLocked: true, phase: true, description: true, clientId: true, excluded: true, updatedAt: true } as const

function view(p: VersionFields & { id: string; updatedAt: Date }) {
  return { id: p.id, name: p.name, kind: p.kind, status: p.status, statusLocked: p.statusLocked, phase: p.phase, clientId: p.clientId, updatedAt: p.updatedAt, version: projectVersion(p), editVersion: projectVersion(p) }
}

export async function updateProjectState(id: string, patch: ProjectStatePatch, opts: MutationOptions = {}) {
  return prisma.$transaction(async (tx) => {
    const found = await lockRow(tx, 'Project', id)
    const cur = found ? await tx.project.findUnique({ where: { id }, select }) : null
    // un proyecto excluido está fuera de Central: no se lista ni se cambia desde fuera
    if (!cur || cur.excluded) throw new MutationError('not_found', 'Ese proyecto no existe')
    checkVersion(opts.expectedVersion, projectVersion(cur), () => view(cur))
    if (patch.status !== undefined && patch.status !== cur.status && cur.statusLocked && patch.statusLocked === undefined) {
      throw new MutationError('status_locked', 'El estado de este proyecto está fijado a mano en Central. Para cambiarlo, envía también statusLocked: true (seguirá fijado con el estado nuevo)', view(cur))
    }
    const changes = changesOf(cur, patch)
    if (Object.keys(changes).length === 0) return view(cur)
    const updated = await tx.project.update({ where: { id }, data: changedData(patch, changes), select })
    await audit(tx, opts.actor, 'update', 'project', id, changes)
    return view(updated)
  })
}
