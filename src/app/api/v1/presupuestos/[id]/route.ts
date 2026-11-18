import { getQuote } from '@/lib/api/quotes'
import { apiRoute, json, notFound } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

/**
 * Presupuesto completo por id o número (P-2026-001): partidas, totales y fases. Cada fase lleva su `id` y su
 * `version`, los que pide `PATCH /presupuestos/{id}/fases/{faseId}`.
 */
export const GET = apiRoute<{ id: string }>('presupuestos', async (_req, { params }) => {
  const q = await getQuote(params.id, { phaseIds: true })
  return q ? json(q) : notFound()
})
