import { revalidatePath } from 'next/cache'
import { createNote, noteCreateSchema, noteTarget } from '@/lib/api/mutations/notes'
import { actorOf, apiRoute, json, writeBody } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

/** Nota nueva en un cliente, un proyecto o una web (`source: api`). 201 con la nota; 422 si el destino no existe. */
export const POST = apiRoute('escritura', async (req, { caller }) => {
  const input = await writeBody(req, noteCreateSchema)
  const dest = noteTarget(input)
  const note = await createNote(input.body, dest, { source: 'api', actor: actorOf(caller) })
  if ('clientId' in dest) revalidatePath(`/clientes/${dest.clientId}`)
  else if ('projectId' in dest) revalidatePath(`/proyectos/${dest.projectId}`)
  else revalidatePath('/webs', 'layout')
  return json({ note }, { status: 201 })
})
