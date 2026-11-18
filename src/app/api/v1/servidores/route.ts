import { listServers } from '@/lib/api/servers'
import { apiRoute, json } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

/** Servidores con su estado y lo que aloja; sin direcciones, IPs ni rutas de clave. */
export const GET = apiRoute('lectura', async () => json({ servers: await listServers() }))
