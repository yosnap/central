import { z } from 'zod'
import { agendaEvents } from '@/lib/api/events'
import { ApiInputError, apiRoute, json, query } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

const MAX_DAYS = 62
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha AAAA-MM-DD')
const Query = z.object({ desde: day.optional(), hasta: day.optional(), cliente: z.string().trim().min(1).max(200).optional() })

/** Eventos de la agenda entre dos días (como mucho 62); por defecto, los próximos 14. */
export const GET = apiRoute('lectura', async (req) => {
  const p = query(req, Query)
  const start = p.desde ? new Date(`${p.desde}T00:00:00`) : new Date()
  const end = p.hasta ? new Date(`${p.hasta}T23:59:59`) : new Date(start.getTime() + 14 * 864e5)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new ApiInputError('Fecha no válida')
  if (end < start) throw new ApiInputError('«hasta» es anterior a «desde»')
  if (end.getTime() - start.getTime() > MAX_DAYS * 864e5) throw new ApiInputError(`Como mucho ${MAX_DAYS} días`)
  return json(await agendaEvents(start, end, p.cliente))
})
