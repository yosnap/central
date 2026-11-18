import { z } from 'zod'
import { QUOTE_STATUSES, createQuote, createQuoteSchema, listQuotes } from '@/lib/api/quotes'
import { ApiInputError, apiRoute, body, json, query } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

const Query = z.object({ cliente: z.string().trim().min(1).max(200).optional(), estado: z.enum(QUOTE_STATUSES).optional() })

/** Presupuestos con su total con IVA (en euros); filtra por cliente (nombre o parte) y estado. */
export const GET = apiRoute('presupuestos', async (req) => {
  const p = query(req, Query)
  return json({ quotes: await listQuotes({ client: p.cliente, status: p.estado }) })
})

/** Crea un presupuesto, siempre en borrador, con el siguiente número del año. Mismo esquema que `create_quote` del MCP. */
export const POST = apiRoute('presupuestos', async (req) => {
  const input = await body(req, createQuoteSchema)
  const r = await createQuote(input)
  if (!r.ok) throw new ApiInputError('No existe ese cliente en Central', 422)
  return json({ id: r.id, number: r.number, status: 'DRAFT' }, { status: 201 })
})
