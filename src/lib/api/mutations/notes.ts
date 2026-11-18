/**
 * Notas de un cliente, un proyecto o una web: las usan las fichas de la web y la API v1 (`POST /notas`).
 * Solo altas; las notas no se cambian ni se borran por la API.
 */
import { z } from 'zod'
import { prisma } from '../../prisma'
import { MutationError } from './errors'
import { audit, changesOf, type ApiActor } from './common'

export const NOTE_MAX = 5000

export type NoteTarget = { clientId: string } | { projectId: string } | { websiteId: string }

const id = z.string().trim().min(1).max(64)

/** Cuerpo de `POST /notas`: el texto y exactamente uno de `clientId`, `projectId` o `websiteId`. */
export const noteCreateSchema = z.strictObject({
  body: z.string().trim().min(1, 'La nota está vacía').max(NOTE_MAX),
  clientId: id.optional(),
  projectId: id.optional(),
  websiteId: id.optional(),
}).refine((d) => [d.clientId, d.projectId, d.websiteId].filter(Boolean).length === 1, 'Indica uno (y solo uno) de clientId, projectId o websiteId')

export function noteTarget(d: { clientId?: string; projectId?: string; websiteId?: string }): NoteTarget {
  if (d.clientId) return { clientId: d.clientId }
  if (d.projectId) return { projectId: d.projectId }
  if (d.websiteId) return { websiteId: d.websiteId }
  throw new MutationError('invalid', 'Falta a qué va la nota')
}

/** `source`: de dónde viene la nota (app = web, api = otra app por la API v1). */
export async function createNote(body: string, target: NoteTarget, { source, actor }: { source: 'app' | 'api'; actor?: ApiActor }) {
  return prisma.$transaction(async (tx) => {
    const exists = 'clientId' in target
      ? await tx.client.findUnique({ where: { id: target.clientId }, select: { id: true } })
      : 'projectId' in target
        ? await tx.project.findUnique({ where: { id: target.projectId }, select: { id: true } })
        : await tx.website.findUnique({ where: { id: target.websiteId }, select: { id: true } })
    if (!exists) throw new MutationError('invalid', 'clientId' in target ? 'No existe ese cliente' : 'projectId' in target ? 'No existe ese proyecto' : 'No existe esa web')
    const n = await tx.note.create({ data: { body, source, ...target } })
    await audit(tx, actor, 'create', 'note', n.id, changesOf({}, { body, ...target }))
    return { id: n.id, body: n.body, pinned: n.pinned, source: n.source, clientId: n.clientId, projectId: n.projectId, websiteId: n.websiteId, createdAt: n.createdAt }
  })
}
