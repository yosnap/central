import { revalidatePath } from 'next/cache'
import { listClients } from '@/lib/api/clients'
import { clientCreateSchema, clientVersion, createClient } from '@/lib/api/mutations/clients'
import { actorOf, apiRoute, json, writeBody } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

/** Clientes con su contacto (correo, teléfono, NIF, dirección), número de proyectos y webs, y su versión. */
export const GET = apiRoute('lectura', async () => json({ clients: (await listClients()).map((c) => ({ ...c, version: clientVersion(c) })) }))

/** Alta de un cliente (nombre único sin distinguir mayúsculas). 201 con el cliente creado; 409 si el nombre ya existe. */
export const POST = apiRoute('escritura', async (req, { caller }) => {
  const input = await writeBody(req, clientCreateSchema)
  const client = await createClient(input, { actor: actorOf(caller) })
  revalidatePath('/clientes')
  revalidatePath('/proyectos', 'layout')
  return json({ client }, { status: 201 })
})
