import { z } from 'zod'
import { agendaEvents, madridDayEnd, madridDayStart } from '@/lib/api/events'
import { ApiInputError, apiRoute, json, query } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

const MAX_DAYS = 62
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha AAAA-MM-DD')
const Query = z.object({ desde: day.optional(), hasta: day.optional(), cliente: z.string().trim().min(1).max(200).optional() })

/** Eventos entre dos días de Europe/Madrid (como mucho 62, ambos incluidos); por defecto, los próximos 14 días desde ahora. */
export const GET = apiRoute('lectura', async (req) => {
  const p = query(req, Query)
  const start = p.desde ? madridDayStart(p.desde) : new Date()
  const end = p.hasta ? madridDayEnd(p.hasta) : start && new Date(start.getTime() + 14 * 864e5)
  if (!start || !end) throw new ApiInputError('Esa fecha no existe')
  if (end < start) throw new ApiInputError('«hasta» es anterior a «desde»')
  if (end.getTime() - start.getTime() > MAX_DAYS * 864e5) throw new ApiInputError(`Como mucho ${MAX_DAYS} días`)
  return json(await agendaEvents(start, end, p.cliente, { genericErrors: true }))
})
