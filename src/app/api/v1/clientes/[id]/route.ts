import { getClient } from '@/lib/api/clients'
import { apiRoute, json, notFound } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

/** Ficha de un cliente: contacto, proyectos, webs y últimas notas. */
export const GET = apiRoute<{ id: string }>('lectura', async (_req, { params }) => {
  const c = await getClient(params.id)
  return c ? json(c) : notFound()
})
