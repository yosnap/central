import { revalidatePath } from 'next/cache'
import { quotePhasePatchSchema, updateQuotePhase } from '@/lib/api/mutations/quote-phases'
import { actorOf, apiRoute, json, notFound, writeBody } from '@/lib/api/route'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Cambia el estado o la fecha prevista (AAAA-MM-DD, o null para quitarla) de una fase de un presupuesto (id o
 * número). Pide los permisos `escritura` y `presupuestos`, y la `version` de la fase (409 si otro la cambió).
 */
export const PATCH = apiRoute<{ id: string; faseId: string }>(['escritura', 'presupuestos'], async (req, { params, caller }) => {
  const { version, ...patch } = await writeBody(req, quotePhasePatchSchema)
  const quote = await prisma.quote.findFirst({ where: { OR: [{ id: params.id }, { number: params.id }] }, select: { id: true } })
  if (!quote) return notFound()
  const phase = await updateQuotePhase(params.faseId, patch, { actor: actorOf(caller), expectedVersion: version, quoteId: quote.id })
  revalidatePath('/presupuestos')
  revalidatePath(`/presupuestos/${quote.id}`)
  revalidatePath('/clientes', 'layout')
  return json({ phase })
})
