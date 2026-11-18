import { z } from 'zod'
import { CursorError, PROJECT_KINDS, PROJECT_STATUSES, listProjects } from '@/lib/api/projects'
import { ApiInputError, apiRoute, json, query } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

const Query = z.object({
  estado: z.enum(PROJECT_STATUSES).optional(),
  tipo: z.enum(PROJECT_KINDS).optional(),
  cliente: z.string().trim().min(1).max(200).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  cursor: z.string().min(1).max(64).optional(),
  limite: z.coerce.number().int().min(1).max(200).default(50),
})

/** Proyectos paginados del más al menos activo; `nextCursor` pide la página siguiente. */
export const GET = apiRoute('lectura', async (req) => {
  const p = query(req, Query)
  try {
    return json(await listProjects({ status: p.estado, kind: p.tipo, client: p.cliente, query: p.q, cursor: p.cursor, limit: p.limite }))
  } catch (e) {
    if (e instanceof CursorError) throw new ApiInputError(e.message)
    throw e
  }
})
