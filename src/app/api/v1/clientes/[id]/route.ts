import { revalidatePath } from 'next/cache'
import { getClient } from '@/lib/api/clients'
import { clientPatchSchema, clientVersion, updateClient } from '@/lib/api/mutations/clients'
import { actorOf, apiRoute, json, notFound, writeBody } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

/** Ficha de un cliente: contacto, proyectos, webs, últimas notas y versión (la que pide `PATCH`). */
export const GET = apiRoute<{ id: string }>('lectura', async (_req, { params }) => {
  const c = await getClient(params.id)
  return c ? json({ ...c, version: clientVersion(c) }) : notFound()
})

/** Cambia los datos indicados de un cliente. Exige la `version` leída: si otro lo cambió antes, 409 con el actual. */
export const PATCH = apiRoute<{ id: string }>('escritura', async (req, { params, caller }) => {
  const { version, ...patch } = await writeBody(req, clientPatchSchema)
  const client = await updateClient(params.id, patch, { actor: actorOf(caller), expectedVersion: version })
  revalidatePath('/clientes')
  revalidatePath(`/clientes/${params.id}`)
  revalidatePath('/proyectos', 'layout')
  return json({ client })
})
