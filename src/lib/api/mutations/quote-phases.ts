/**
 * Cambios de una fase (hito de pago) de un presupuesto: los usan la ficha de la web, `update_phase` del MCP y la
 * API v1 (`PATCH /presupuestos/{id}/fases/{faseId}`, solo estado y fecha prevista).
 * Hecha o facturada: se apunta cuándo (de hecha a facturada se conserva la fecha); si vuelve atrás, se borra.
 */
import { z } from 'zod'
import { prisma } from '../../prisma'
import { MutationError } from './errors'
import { VERSION_PATTERN, audit, changedData, changesOf, checkVersion, lockRow, versionOf, type MutationOptions } from './common'

export const PHASE_STATUS_VALUES = ['PENDING', 'IN_PROGRESS', 'DONE', 'INVOICED'] as const
export type PhaseStatusValue = (typeof PHASE_STATUS_VALUES)[number]

export type QuotePhasePatch = { name?: string; description?: string | null; percent?: number | null; dueDate?: Date | null; status?: PhaseStatusValue }

/** Día del calendario (AAAA-MM-DD) que existe de verdad; se guarda a mediodía UTC para que no cambie de día en Madrid. */
export const calendarDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida (AAAA-MM-DD)').refine((v) => {
  const d = new Date(`${v}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}, 'Esa fecha no existe').transform((v) => new Date(`${v}T12:00:00Z`))

export const quotePhasePatchSchema = z.strictObject({
  version: z.string().regex(VERSION_PATTERN, 'Versión no válida: usa la de la última lectura'),
  status: z.enum(PHASE_STATUS_VALUES).optional(),
  dueDate: calendarDay.nullable().optional(),
}).refine((d) => d.status !== undefined || d.dueDate !== undefined, 'Indica el estado o la fecha prevista')

type PhaseRow = { id: string; quoteId: string; name: string; description: string | null; percent: unknown; dueDate: Date | null; status: string; completedAt: Date | null }

/** Versión de una fase: lo que se edita de ella. */
export const quotePhaseVersion = (p: Omit<PhaseRow, 'id' | 'quoteId' | 'completedAt'>) =>
  versionOf({ name: p.name, description: p.description, percent: p.percent, dueDate: p.dueDate, status: p.status })

function view(p: PhaseRow) {
  return { id: p.id, quoteId: p.quoteId, name: p.name, description: p.description, dueDate: p.dueDate, status: p.status, completedAt: p.completedAt, version: quotePhaseVersion(p) }
}

/** `quoteId`: si se indica, la fase tiene que ser de ese presupuesto (si no, 404). */
export async function updateQuotePhase(id: string, patch: QuotePhasePatch, opts: MutationOptions & { quoteId?: string } = {}) {
  return prisma.$transaction(async (tx) => {
    const found = await lockRow(tx, 'QuotePhase', id)
    const cur = found ? await tx.quotePhase.findUnique({ where: { id } }) : null
    if (!cur || (opts.quoteId && cur.quoteId !== opts.quoteId)) throw new MutationError('not_found', 'Esa fase no existe en este presupuesto')
    checkVersion(opts.expectedVersion, quotePhaseVersion(cur), () => view(cur))
    const changes = changesOf(cur, patch)
    if (Object.keys(changes).length === 0) return view(cur)
    const data: QuotePhasePatch & { completedAt?: Date | null } = changedData(patch, changes)
    if (changes.status) {
      const done = patch.status === 'DONE' || patch.status === 'INVOICED'
      data.completedAt = done ? (cur.completedAt ?? new Date()) : null
    }
    const updated = await tx.quotePhase.update({ where: { id }, data })
    await audit(tx, opts.actor, 'update', 'quotePhase', id, changes)
    return view(updated)
  })
}
