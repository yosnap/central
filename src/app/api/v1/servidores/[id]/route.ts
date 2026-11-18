import { getServer } from '@/lib/api/servers'
import { apiRoute, json, notFound } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

/** Ficha de un servidor: tarjetas de salud, protección, contenedores y proyectos. */
export const GET = apiRoute<{ id: string }>('lectura', async (_req, { params }) => {
  const s = await getServer(params.id)
  return s ? json(s) : notFound()
})
