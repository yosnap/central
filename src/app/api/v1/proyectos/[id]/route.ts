import { revalidatePath } from 'next/cache'
import { projectPatchSchema, projectVersion, updateProjectState } from '@/lib/api/mutations/projects'
import { getProject, publicProject } from '@/lib/api/projects'
import { actorOf, apiRoute, json, notFound, writeBody } from '@/lib/api/route'
import { WRITE_SCOPES } from '@/lib/api/scopes'

export const dynamic = 'force-dynamic'

/** Ficha de un proyecto: repositorio, ubicaciones, servicios, webs, últimas notas y versión (la que pide `PATCH`). */
export const GET = apiRoute<{ id: string }>('lectura', async (_req, { params }) => {
  const p = await getProject(params.id)
  return p ? json({ ...publicProject(p), version: projectVersion(p) }) : notFound()
})

/**
 * Cambia el estado, si queda fijado (`statusLocked`) y la fase de un proyecto. Exige la `version` leída (409 si otro
 * lo cambió); con el estado fijado a mano, cambiarlo pide también `statusLocked` (409 `status_locked` si no).
 */
export const PATCH = apiRoute<{ id: string }>(WRITE_SCOPES, async (req, { params, caller }) => {
  const { version, ...patch } = await writeBody(req, projectPatchSchema)
  const project = await updateProjectState(params.id, patch, { actor: actorOf(caller), expectedVersion: version })
  revalidatePath(`/proyectos/${params.id}`)
  revalidatePath('/proyectos')
  revalidatePath('/pendientes')
  return json({ project })
})
