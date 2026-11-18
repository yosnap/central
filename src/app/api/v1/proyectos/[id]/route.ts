import { getProject, publicProject } from '@/lib/api/projects'
import { apiRoute, json, notFound } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

/** Ficha de un proyecto: repositorio, ubicaciones, servicios, webs y últimas notas. */
export const GET = apiRoute<{ id: string }>('lectura', async (_req, { params }) => {
  const p = await getProject(params.id)
  return p ? json(publicProject(p)) : notFound()
})
