import { listClients } from '@/lib/api/clients'
import { apiRoute, json } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

/** Clientes con su contacto (correo, teléfono, NIF, dirección) y número de proyectos y webs. */
export const GET = apiRoute('lectura', async () => json({ clients: await listClients() }))
