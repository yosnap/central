import { collectAlerts } from '@/lib/alerts'
import { scrubDeep } from '@/lib/api/scrub'
import { apiRoute, json } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

/** Alertas abiertas (webs, certificados, servidores, parches y dependencias), primero las críticas. Sin IPs ni rutas de clave en los textos. */
export const GET = apiRoute('lectura', async () => json({ alerts: scrubDeep(await collectAlerts()) }))
