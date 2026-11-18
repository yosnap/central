import { collectAlerts } from '@/lib/alerts'
import { apiRoute, json } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

/** Alertas abiertas (webs, certificados, servidores, parches y dependencias), primero las críticas. */
export const GET = apiRoute('lectura', async () => json({ alerts: await collectAlerts() }))
